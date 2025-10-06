import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TasksService } from '../../modules/tasks/tasks.service';
import { Task } from '@modules/tasks/entities/task.entity';
import { TaskStatus } from '@modules/tasks/enums/task-status.enum';

@Injectable()
@Processor('task-processing', {
  concurrency: 10,
  removeOnComplete: { age: 3600 },
})
export class TaskProcessorService extends WorkerHost {
  private readonly logger = new Logger(TaskProcessorService.name);

  constructor(private readonly tasksService: TasksService) {
    super();
  }

  // Inefficient implementation:
  // - No proper job batching
  // - No error handling strategy
  // - No retries for failed jobs
  // - No concurrency control
  async process(job: Job): Promise<any> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case 'task-status-update':
          return await this.handleStatusUpdate(job);
        case 'overdue-tasks-notification':
          return await this.handleOverdueTasks(job);
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
          return { success: false, error: 'Unknown job type' };
      }
    } catch (error) {
      // Basic error logging without proper handling or retries
      this.logger.error(
        `Error processing job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error; // Simply rethrows the error without any retry strategy
    }
  }

  private async handleStatusUpdate(job: Job & { data: { taskId: string; status: TaskStatus } }) {
    const { taskId, status } = job.data;

    if (!taskId || !status) {
      this.logger.warn(`Missing required data for job ${job.id}`);
      throw new Error(`Missing required data`);
    }

    if (!Object.values(TaskStatus).includes(status)) {
      this.logger.warn(`Invalid status value for job ${job.id}`);
      throw new Error(`Invalid status value`);
    }

    const task = await this.tasksService.updateStatus(taskId, status);

    return {
      success: true,
      taskId: task.id,
      newStatus: task.status,
    };
  }

  private async handleOverdueTasks(job: Job & { data: Task }) {
    // Inefficient implementation with no batching or chunking for large datasets
    this.logger.debug('Processing overdue tasks notification');

    // The implementation is deliberately basic and inefficient
    // It should be improved with proper batching and error handling
    await this.tasksService.update(job.data.id, { status: TaskStatus.OVERDUE });
    // Add logic to notify users about their overdue tasks

    return { success: true, message: 'Overdue tasks processed' };
  }
}
