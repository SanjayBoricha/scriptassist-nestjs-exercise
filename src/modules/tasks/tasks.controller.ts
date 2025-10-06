import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaskFilterDto } from './dto/task-filter.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { User } from '@modules/users/entities/user.entity';
import { TaskBatchDto } from './dto/task-batch.dto';
import { UserRole } from '@modules/users/enums/user-role.enum';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('tasks')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({})
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Find all tasks with optional filtering' })
  async findAll(@Query() filterDto: TaskFilterDto, @CurrentUser() user: User) {
    const tasks = await this.tasksService.findAll({
      ...filterDto,
      // Ensure users can only see their own tasks
      // If user is admin then they can filter
      userId: user.role === UserRole.ADMIN ? filterDto.userId : user.id,
    });

    return tasks;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  async getStats(@CurrentUser() user: User) {
    return this.tasksService.getStatistics(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a task by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const task = await this.tasksService.findOne(id);
    if (!task) throw new HttpException(`Task not found.`, HttpStatus.NOT_FOUND);
    if (task.userId !== user.id) throw new HttpException(`Forbidden`, HttpStatus.FORBIDDEN);
    return task;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  async update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    const task = await this.tasksService.findOne(id);
    if (!task) throw new HttpException(`Task not found.`, HttpStatus.NOT_FOUND);
    if (task.userId !== user.id) throw new HttpException(`Forbidden`, HttpStatus.FORBIDDEN);
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const task = await this.tasksService.findOne(id);
    if (!task) throw new HttpException(`Task not found.`, HttpStatus.NOT_FOUND);
    if (task.userId !== user.id) throw new HttpException(`Forbidden`, HttpStatus.FORBIDDEN);
    return this.tasksService.remove(id);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch process multiple tasks' })
  async batchProcess(@Body() operations: TaskBatchDto, @CurrentUser() user: User) {
    const { tasks: taskIds, action } = operations;

    if (!['complete', 'delete'].includes(action)) {
      throw new HttpException(`Unknown action: ${action}`, HttpStatus.BAD_REQUEST);
    }

    return this.tasksService.batchProcess(taskIds, action as 'complete' | 'delete', user.id);
  }
}
