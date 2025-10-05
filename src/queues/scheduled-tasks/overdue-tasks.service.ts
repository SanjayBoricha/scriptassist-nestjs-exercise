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

  // TODO: Implement the overdue tasks checker
  // This method should run every hour and check for overdue tasks
  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueTasks() {
    this.logger.debug('Checking for overdue tasks...');

    // TODO: Implement overdue tasks checking logic
    // 1. Find all tasks that are overdue (due date is in the past)
    // 2. Add them to the task processing queue
    // 3. Log the number of overdue tasks found

    // Example implementation (incomplete - to be implemented by candidates)

    const overdueTasks = await this.tasksService.getOverdueTasks();

    this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

    // Add tasks to the queue to be processed
    // TODO: Implement adding tasks to the queue

    // this.taskQueue.add('overdue-tasks-notification', {
    //   taskIds: overdueTasks.map(task => task.id),
    // });

    this.logger.debug('Overdue tasks check completed');
  }
}
