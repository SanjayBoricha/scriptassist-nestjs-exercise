import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from '../../src/modules/tasks/tasks.controller';
import { TasksService } from '../../src/modules/tasks/tasks.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CreateTaskDto } from '../../src/modules/tasks/dto/create-task.dto';
import { UpdateTaskDto } from '../../src/modules/tasks/dto/update-task.dto';
import { TaskFilterDto } from '../../src/modules/tasks/dto/task-filter.dto';
import { TaskBatchDto } from '../../src/modules/tasks/dto/task-batch.dto';
import { Task } from '../../src/modules/tasks/entities/task.entity';
import { TaskStatus } from '../../src/modules/tasks/enums/task-status.enum';
import { TaskPriority } from '../../src/modules/tasks/enums/task-priority.enum';
import { UserRole } from '../../src/modules/users/enums/user-role.enum';

// Define User interface to avoid importing entities
interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  refreshToken: string;
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: jest.Mocked<TasksService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    password: 'hashedPassword',
    role: UserRole.USER,
    isActive: true,
    refreshToken: '',
    tasks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdmin: User = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'hashedPassword',
    role: UserRole.ADMIN,
    isActive: true,
    refreshToken: '',
    tasks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTask: Task = {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test Description',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date('2025-12-31'),
    userId: 'user-1',
    user: mockUser,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOtherUserTask: Task = {
    ...mockTask,
    id: 'task-2',
    userId: 'user-2',
  };

  beforeEach(async () => {
    const mockTasksService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getStatistics: jest.fn(),
      batchProcess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockTasksService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(LoggingInterceptor)
      .useValue({ intercept: jest.fn().mockImplementation((context, next) => next.handle()) })
      .compile();

    controller = module.get<TasksController>(TasksController);
    tasksService = module.get(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new task successfully', async () => {
      const createTaskDto: CreateTaskDto = {
        title: 'New Task',
        description: 'Task Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        userId: 'user-1',
        dueDate: new Date('2025-12-31'),
      };

      tasksService.create.mockResolvedValue(mockTask);

      const result = await controller.create(createTaskDto);

      expect(result).toEqual(mockTask);
      expect(tasksService.create).toHaveBeenCalledWith(createTaskDto);
    });

    it('should handle service errors during task creation', async () => {
      const createTaskDto: CreateTaskDto = {
        title: 'New Task',
        userId: 'user-1',
      };

      const error = new Error('Database error');
      tasksService.create.mockRejectedValue(error);

      await expect(controller.create(createTaskDto)).rejects.toThrow(error);
      expect(tasksService.create).toHaveBeenCalledWith(createTaskDto);
    });
  });

  describe('findAll', () => {
    it('should return tasks for regular user with their userId', async () => {
      const filterDto: TaskFilterDto = {
        page: 1,
        limit: 10,
        status: TaskStatus.PENDING,
      };

      const expectedResult = {
        items: [mockTask],
        count: 1,
        total: 1,
      };

      tasksService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filterDto, mockUser);

      expect(result).toEqual(expectedResult);
      expect(tasksService.findAll).toHaveBeenCalledWith({
        ...filterDto,
        userId: mockUser.id,
      });
    });

    it('should allow admin to filter by different userId', async () => {
      const filterDto: TaskFilterDto = {
        page: 1,
        limit: 10,
        userId: 'user-2',
      };

      const expectedResult = {
        items: [],
        count: 0,
        total: 0,
      };

      tasksService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filterDto, mockAdmin);

      expect(result).toEqual(expectedResult);
      expect(tasksService.findAll).toHaveBeenCalledWith({
        ...filterDto,
        userId: 'user-2',
      });
    });

    it('should override userId for regular user even if provided in filter', async () => {
      const filterDto: TaskFilterDto = {
        page: 1,
        limit: 10,
        userId: 'user-2', // User tries to access another user's tasks
      };

      const expectedResult = {
        items: [mockTask],
        count: 1,
        total: 1,
      };

      tasksService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filterDto, mockUser);

      expect(result).toEqual(expectedResult);
      expect(tasksService.findAll).toHaveBeenCalledWith({
        ...filterDto,
        userId: mockUser.id, // Should use authenticated user's ID
      });
    });
  });

  describe('getStats', () => {
    it('should return task statistics for authenticated user', async () => {
      const mockStats = {
        total: 5,
        completed: 2,
        inProgress: 1,
        pending: 1,
        overdue: 1,
        highPriority: 2,
      };

      tasksService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockUser);

      expect(result).toEqual(mockStats);
      expect(tasksService.getStatistics).toHaveBeenCalledWith(mockUser.id);
    });

    it('should handle empty statistics', async () => {
      const emptyStats = {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        overdue: 0,
        highPriority: 0,
      };

      tasksService.getStatistics.mockResolvedValue(emptyStats);

      const result = await controller.getStats(mockUser);

      expect(result).toEqual(emptyStats);
      expect(tasksService.getStatistics).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('findOne', () => {
    it('should return a task for the owner', async () => {
      tasksService.findOne.mockResolvedValue(mockTask);

      const result = await controller.findOne('task-1', mockUser);

      expect(result).toEqual(mockTask);
      expect(tasksService.findOne).toHaveBeenCalledWith('task-1');
    });

    it('should throw NotFound when task does not exist', async () => {
      tasksService.findOne.mockResolvedValue(null as any);

      await expect(controller.findOne('nonexistent', mockUser)).rejects.toThrow(
        new HttpException('Task not found.', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw Forbidden when user tries to access another user task', async () => {
      tasksService.findOne.mockResolvedValue(mockOtherUserTask);

      await expect(controller.findOne('task-2', mockUser)).rejects.toThrow(
        new HttpException('Forbidden', HttpStatus.FORBIDDEN),
      );
    });
  });

  describe('update', () => {
    const updateTaskDto: UpdateTaskDto = {
      title: 'Updated Task',
      status: TaskStatus.IN_PROGRESS,
    };

    it('should update a task for the owner', async () => {
      const updatedTask = { ...mockTask, ...updateTaskDto };
      tasksService.findOne.mockResolvedValue(mockTask);
      tasksService.update.mockResolvedValue(updatedTask);

      const result = await controller.update('task-1', updateTaskDto, mockUser);

      expect(result).toEqual(updatedTask);
      expect(tasksService.findOne).toHaveBeenCalledWith('task-1');
      expect(tasksService.update).toHaveBeenCalledWith('task-1', updateTaskDto);
    });

    it('should throw NotFound when task does not exist', async () => {
      tasksService.findOne.mockResolvedValue(null as any);

      await expect(controller.update('nonexistent', updateTaskDto, mockUser)).rejects.toThrow(
        new HttpException('Task not found.', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw Forbidden when user tries to update another user task', async () => {
      tasksService.findOne.mockResolvedValue(mockOtherUserTask);

      await expect(controller.update('task-2', updateTaskDto, mockUser)).rejects.toThrow(
        new HttpException('Forbidden', HttpStatus.FORBIDDEN),
      );
    });
  });

  describe('remove', () => {
    it('should remove a task for the owner', async () => {
      tasksService.findOne.mockResolvedValue(mockTask);
      tasksService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('task-1', mockUser);

      expect(result).toBeUndefined();
      expect(tasksService.findOne).toHaveBeenCalledWith('task-1');
      expect(tasksService.remove).toHaveBeenCalledWith('task-1');
    });

    it('should throw NotFound when task does not exist', async () => {
      tasksService.findOne.mockResolvedValue(null as any);

      await expect(controller.remove('nonexistent', mockUser)).rejects.toThrow(
        new HttpException('Task not found.', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw Forbidden when user tries to remove another user task', async () => {
      tasksService.findOne.mockResolvedValue(mockOtherUserTask);

      await expect(controller.remove('task-2', mockUser)).rejects.toThrow(
        new HttpException('Forbidden', HttpStatus.FORBIDDEN),
      );
    });
  });

  describe('batchProcess', () => {
    it('should process batch complete operation successfully', async () => {
      const batchDto: TaskBatchDto = {
        tasks: ['task-1', 'task-2'],
        action: 'complete',
      };

      const mockResult = [
        { taskId: 'task-1', success: true, result: 'Task marked as completed' },
        { taskId: 'task-2', success: true, result: 'Task marked as completed' },
      ];

      tasksService.batchProcess.mockResolvedValue(mockResult);

      const result = await controller.batchProcess(batchDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(tasksService.batchProcess).toHaveBeenCalledWith(
        batchDto.tasks,
        batchDto.action,
        mockUser.id,
      );
    });

    it('should process batch delete operation successfully', async () => {
      const batchDto: TaskBatchDto = {
        tasks: ['task-1', 'task-2'],
        action: 'delete',
      };

      const mockResult = [
        { taskId: 'task-1', success: true, result: 'Task deleted' },
        { taskId: 'task-2', success: false, error: 'Task not found' },
      ];

      tasksService.batchProcess.mockResolvedValue(mockResult);

      const result = await controller.batchProcess(batchDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(tasksService.batchProcess).toHaveBeenCalledWith(
        batchDto.tasks,
        batchDto.action,
        mockUser.id,
      );
    });

    it('should throw BadRequest for unknown action', async () => {
      const batchDto: TaskBatchDto = {
        tasks: ['task-1'],
        action: 'unknown' as any,
      };

      await expect(controller.batchProcess(batchDto, mockUser)).rejects.toThrow(
        new HttpException('Unknown action: unknown', HttpStatus.BAD_REQUEST),
      );

      expect(tasksService.batchProcess).not.toHaveBeenCalled();
    });

    it('should handle empty task list', async () => {
      const batchDto: TaskBatchDto = {
        tasks: [],
        action: 'complete',
      };

      const mockResult: any[] = [];
      tasksService.batchProcess.mockResolvedValue(mockResult);

      const result = await controller.batchProcess(batchDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(tasksService.batchProcess).toHaveBeenCalledWith([], 'complete', mockUser.id);
    });

    it('should handle mixed success and failure results', async () => {
      const batchDto: TaskBatchDto = {
        tasks: ['task-1', 'task-2', 'task-3'],
        action: 'complete',
      };

      const mockResult = [
        { taskId: 'task-1', success: true, result: 'Task marked as completed' },
        { taskId: 'task-2', success: false, error: 'Task not found' },
        { taskId: 'task-3', success: false, error: 'Permission denied' },
      ];

      tasksService.batchProcess.mockResolvedValue(mockResult);

      const result = await controller.batchProcess(batchDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(tasksService.batchProcess).toHaveBeenCalledWith(
        batchDto.tasks,
        'complete',
        mockUser.id,
      );
    });
  });
});
