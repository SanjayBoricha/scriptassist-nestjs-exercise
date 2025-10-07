import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from '../../src/modules/tasks/tasks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../../src/modules/tasks/entities/task.entity';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from '../../src/modules/tasks/dto/create-task.dto';
import { UpdateTaskDto } from '../../src/modules/tasks/dto/update-task.dto';
import { TaskFilterDto } from '../../src/modules/tasks/dto/task-filter.dto';
import { TaskStatus } from '../../src/modules/tasks/enums/task-status.enum';
import { TaskPriority } from '../../src/modules/tasks/enums/task-priority.enum';
import { UserRole } from '../../src/modules/users/enums/user-role.enum';

describe('TasksService', () => {
  let service: TasksService;
  let repository: jest.Mocked<Repository<Task>>;
  let taskQueue: jest.Mocked<Queue>;

  const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    description: 'Test Description',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date('2025-12-31'),
    userId: 'user-1',
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      password: 'hashedPassword',
      role: UserRole.USER,
      refreshToken: '',
      tasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getCount: jest.fn(),
    addSelect: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    delete: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      query: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    const mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: mockRepository },
        { provide: getQueueToken('task-processing'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get(getRepositoryToken(Task));
    taskQueue = module.get(getQueueToken('task-processing'));

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createTaskDto: CreateTaskDto = {
      title: 'New Task',
      description: 'New Description',
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      userId: 'user-1',
      dueDate: new Date('2025-12-31'),
    };

    it('should create a new task successfully', async () => {
      const createdTask = { ...mockTask, ...createTaskDto };
      repository.create.mockReturnValue(createdTask);
      repository.save.mockResolvedValue(createdTask);
      taskQueue.add.mockResolvedValue({} as any);

      const result = await service.create(createTaskDto);

      expect(result).toEqual(createdTask);
      expect(repository.create).toHaveBeenCalledWith(createTaskDto);
      expect(repository.save).toHaveBeenCalledWith(createdTask);
      expect(taskQueue.add).toHaveBeenCalledWith('task-status-update', {
        taskId: createdTask.id,
        status: createdTask.status,
      });
    });

    it('should handle task creation without optional fields', async () => {
      const minimalTaskDto: CreateTaskDto = {
        title: 'Minimal Task',
        userId: 'user-1',
      };

      const createdTask = { ...mockTask, ...minimalTaskDto };
      repository.create.mockReturnValue(createdTask);
      repository.save.mockResolvedValue(createdTask);
      taskQueue.add.mockResolvedValue({} as any);

      const result = await service.create(minimalTaskDto);

      expect(result).toEqual(createdTask);
      expect(repository.create).toHaveBeenCalledWith(minimalTaskDto);
      expect(repository.save).toHaveBeenCalledWith(createdTask);
    });
  });

  describe('findAll', () => {
    const filterDto: TaskFilterDto = {
      page: 1,
      limit: 10,
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      userId: 'user-1',
    };

    it('should return paginated tasks with filters', async () => {
      const tasks = [mockTask];
      const total = 1;

      mockQueryBuilder.getMany.mockResolvedValue(tasks);
      mockQueryBuilder.getCount.mockResolvedValue(total);

      const result = await service.findAll(filterDto);

      expect(result).toEqual({
        items: tasks,
        count: tasks.length,
        total: total,
      });

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('task.status = :status', {
        status: filterDto.status,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('task.priority = :priority', {
        priority: filterDto.priority,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('task.userId = :userId', {
        userId: filterDto.userId,
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should return tasks without filters when no filters provided', async () => {
      const noFilterDto: TaskFilterDto = {
        page: 1,
        limit: 10,
      };
      const tasks = [mockTask];

      mockQueryBuilder.getMany.mockResolvedValue(tasks);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const result = await service.findAll(noFilterDto);

      expect(result.items).toEqual(tasks);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('1=1', {});
    });

    it('should handle pagination correctly for page 2', async () => {
      const paginationDto: TaskFilterDto = {
        page: 2,
        limit: 5,
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);
      mockQueryBuilder.getCount.mockResolvedValue(0);

      await service.findAll(paginationDto);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      repository.findOne.mockResolvedValue(mockTask);

      const result = await service.findOne('1');

      expect(result).toEqual(mockTask);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NotFoundException when task not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(
        new NotFoundException('Task with ID 999 not found'),
      );

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '999' } });
    });
  });

  describe('update', () => {
    const updateTaskDto: UpdateTaskDto = {
      title: 'Updated Task',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
    };

    it('should update a task successfully', async () => {
      const updatedTask = { ...mockTask, ...updateTaskDto };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockTask);
      repository.save.mockResolvedValue(updatedTask);
      taskQueue.add.mockResolvedValue({} as any);

      const result = await service.update('1', updateTaskDto);

      expect(result).toEqual(updatedTask);
      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(repository.save).toHaveBeenCalledWith(updatedTask);
      expect(taskQueue.add).toHaveBeenCalledWith('task-status-update', {
        taskId: updatedTask.id,
        status: updatedTask.status,
      });
    });

    it('should not add to queue if status unchanged', async () => {
      const updateWithoutStatusChange: UpdateTaskDto = {
        title: 'Updated Task',
        priority: TaskPriority.HIGH,
      };
      const updatedTask = { ...mockTask, ...updateWithoutStatusChange };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockTask);
      repository.save.mockResolvedValue(updatedTask);

      await service.update('1', updateWithoutStatusChange);

      expect(taskQueue.add).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when task not found', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new NotFoundException('Task with ID 999 not found'));

      await expect(service.update('999', updateTaskDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a task successfully', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockTask);
      repository.remove.mockResolvedValue(mockTask);

      await service.remove('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(repository.remove).toHaveBeenCalledWith(mockTask);
    });

    it('should throw NotFoundException when task not found', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new NotFoundException('Task with ID 999 not found'));

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStatus', () => {
    it('should return tasks with specific status', async () => {
      const tasks = [mockTask];
      repository.query.mockResolvedValue(tasks);

      const result = await service.findByStatus(TaskStatus.PENDING);

      expect(result).toEqual(tasks);
      expect(repository.query).toHaveBeenCalledWith('SELECT * FROM tasks WHERE status = $1', [
        TaskStatus.PENDING,
      ]);
    });

    it('should handle different task statuses', async () => {
      const tasks = [{ ...mockTask, status: TaskStatus.COMPLETED }];
      repository.query.mockResolvedValue(tasks);

      const result = await service.findByStatus(TaskStatus.COMPLETED);

      expect(result).toEqual(tasks);
      expect(repository.query).toHaveBeenCalledWith('SELECT * FROM tasks WHERE status = $1', [
        TaskStatus.COMPLETED,
      ]);
    });
  });

  describe('updateStatus', () => {
    it('should update task status successfully', async () => {
      const updatedTask = { ...mockTask, status: TaskStatus.COMPLETED };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockTask);
      repository.save.mockResolvedValue(updatedTask);

      const result = await service.updateStatus('1', TaskStatus.COMPLETED);

      expect(result).toEqual(updatedTask);
      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(repository.save).toHaveBeenCalledWith(updatedTask);
    });
  });

  describe('getStatistics', () => {
    it('should return task statistics for a user', async () => {
      const mockStats = {
        total: '5',
        [TaskStatus.COMPLETED]: '2',
        [TaskStatus.IN_PROGRESS]: '1',
        [TaskStatus.PENDING]: '1',
        [TaskStatus.OVERDUE]: '1',
        [TaskPriority.HIGH]: '2',
      };

      mockQueryBuilder.getRawOne.mockResolvedValue(mockStats);

      const result = await service.getStatistics('user-1');

      expect(result).toEqual({
        total: 5,
        completed: 2,
        inProgress: 1,
        pending: 1,
        overdue: 1,
        highPriority: 2,
      });

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('task.userId = :userId', {
        userId: 'user-1',
      });
    });

    it('should handle empty statistics', async () => {
      const mockEmptyStats = {
        total: '0',
      };

      mockQueryBuilder.getRawOne.mockResolvedValue(mockEmptyStats);

      const result = await service.getStatistics('user-2');

      expect(result).toEqual({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        overdue: 0,
        highPriority: 0,
      });
    });
  });

  describe('batchProcess', () => {
    const taskIds = ['1', '2', '3'];
    const userId = 'user-1';

    it('should complete tasks in batch successfully', async () => {
      const foundTasks = [
        { ...mockTask, id: '1' },
        { ...mockTask, id: '2' },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(foundTasks);
      mockQueryBuilder.execute.mockResolvedValue({ affected: 2 });

      const result = await service.batchProcess(taskIds, 'complete', userId);

      expect(result).toEqual([
        { taskId: '3', success: false, error: 'Task not found' },
        { taskId: '1', success: true, result: 'Task marked as completed' },
        { taskId: '2', success: true, result: 'Task marked as completed' },
      ]);

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({ status: TaskStatus.COMPLETED });
    });

    it('should delete tasks in batch successfully', async () => {
      const foundTasks = [{ ...mockTask, id: '1' }];

      mockQueryBuilder.getMany.mockResolvedValue(foundTasks);
      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.batchProcess(['1', '2'], 'delete', userId);

      expect(result).toEqual([
        { taskId: '2', success: false, error: 'Task not found' },
        { taskId: '1', success: true, result: 'Task deleted' },
      ]);

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should handle database errors in batch operations', async () => {
      const foundTasks = [{ ...mockTask, id: '1' }];
      const dbError = new Error('Database connection failed');

      mockQueryBuilder.getMany.mockResolvedValue(foundTasks);
      mockQueryBuilder.execute.mockRejectedValue(dbError);

      const result = await service.batchProcess(['1'], 'complete', userId);

      expect(result).toEqual([
        { taskId: '1', success: false, error: 'Database connection failed' },
      ]);
    });
  });

  describe('getOverdueTasks', () => {
    it('should return overdue tasks', async () => {
      const overdueTasks = [
        {
          ...mockTask,
          dueDate: new Date('2020-01-01'),
          status: TaskStatus.PENDING,
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(overdueTasks);

      const result = await service.getOverdueTasks();

      expect(result).toEqual(overdueTasks);
      expect(repository.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('task.dueDate < :now', {
        now: expect.any(Date),
      });
    });

    it('should return empty array when no overdue tasks', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getOverdueTasks();

      expect(result).toEqual([]);
    });
  });
});
