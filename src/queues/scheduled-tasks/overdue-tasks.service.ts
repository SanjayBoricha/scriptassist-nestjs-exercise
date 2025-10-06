import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TasksService } from '@modules/tasks/tasks.service';

@Injectable()
export class OverdueTasksService {
  private readonly logger = new Logger(OverdueTasksService.name);

  constructor(
    @InjectQueue('task-processing')
    private taskQueue: Queue,
    private readonly tasksService: TasksService,
  ) {}

  // This method should run every hour and check for overdue tasks
  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueTasks() {
    this.logger.debug('Checking for overdue tasks...');

    const overdueTasks = await this.tasksService.getOverdueTasks();

    this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

    // Add tasks to the queue to be processed
    await Promise.all(
      overdueTasks.map(task =>
        this.taskQueue.add('overdue-tasks-notification', task, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute
          },
          removeOnComplete: {
            age: 86400, // 1 day
          },
          removeOnFail: false,
          priority: 1,
        }),
      ),
    );

    this.logger.debug('Overdue tasks check completed');
  }
}
