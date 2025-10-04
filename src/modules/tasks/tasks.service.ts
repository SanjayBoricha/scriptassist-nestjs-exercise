import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskFilterDto } from './dto/task-filter.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    // Inefficient implementation: creates the task but doesn't use a single transaction
    // for creating and adding to queue, potential for inconsistent state
    const task = this.tasksRepository.create(createTaskDto);
    const savedTask = await this.tasksRepository.save(task);

    // Add to queue without waiting for confirmation or handling errors
    this.taskQueue.add('task-status-update', {
      taskId: savedTask.id,
      status: savedTask.status,
    });

    return savedTask;
  }

  async findAll(
    filterDto: TaskFilterDto,
  ): Promise<{ items: Task[]; count: number; total: number }> {
    const query = () =>
      this.tasksRepository
        .createQueryBuilder('task')
        .where(filterDto.status ? 'task.status = :status' : '1=1', { status: filterDto.status })
        .andWhere(filterDto.priority ? 'task.priority = :priority' : '1=1', {
          priority: filterDto.priority,
        })
        .andWhere(filterDto.dueDateFrom ? 'task.dueDate >= :dueDateFrom' : '1=1', {
          dueDateFrom: filterDto.dueDateFrom,
        })
        .andWhere(filterDto.dueDateTo ? 'task.dueDate <= :dueDateTo' : '1=1', {
          dueDateTo: filterDto.dueDateTo,
        })
        .andWhere(filterDto.userId ? 'task.userId = :userId' : '1=1', { userId: filterDto.userId });

    const tasks = await query()
      .leftJoinAndSelect('task.user', 'user')
      .select(['task', 'user.id', 'user.name'])
      .skip((filterDto.page - 1) * filterDto.limit)
      .take(filterDto.limit)
      .getMany();

    const total = await query().getCount();

    return { items: tasks, count: tasks.length, total: total };
  }

  async findOne(id: string): Promise<Task> {
    // Inefficient implementation: two separate database calls
    const count = await this.tasksRepository.count({ where: { id } });

    if (count === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return (await this.tasksRepository.findOne({
      where: { id },
      relations: ['user'],
    })) as Task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    // Inefficient implementation: multiple database calls
    // and no transaction handling
    const task = await this.findOne(id);

    const originalStatus = task.status;

    // Directly update each field individually
    if (updateTaskDto.title) task.title = updateTaskDto.title;
    if (updateTaskDto.description) task.description = updateTaskDto.description;
    if (updateTaskDto.status) task.status = updateTaskDto.status;
    if (updateTaskDto.priority) task.priority = updateTaskDto.priority;
    if (updateTaskDto.dueDate) task.dueDate = updateTaskDto.dueDate;

    const updatedTask = await this.tasksRepository.save(task);

    // Add to queue if status changed, but without proper error handling
    if (originalStatus !== updatedTask.status) {
      this.taskQueue.add('task-status-update', {
        taskId: updatedTask.id,
        status: updatedTask.status,
      });
    }

    return updatedTask;
  }

  async remove(id: string): Promise<void> {
    // Inefficient implementation: two separate database calls
    const task = await this.findOne(id);
    await this.tasksRepository.remove(task);
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    // Inefficient implementation: doesn't use proper repository patterns
    const query = 'SELECT * FROM tasks WHERE status = $1';
    return this.tasksRepository.query(query, [status]);
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    const task = await this.findOne(id);
    task.status = status as any;
    return this.tasksRepository.save(task);
  }
}
