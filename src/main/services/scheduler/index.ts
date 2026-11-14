import * as cron from 'node-cron';

export interface ScheduledTask {
  id: string;
  name: string;
  expression: string; // Cron expression
  action: () => void | Promise<void>;
  enabled: boolean;
}

export class SchedulerService {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  schedule(task: ScheduledTask) {
    if (this.tasks.has(task.id)) {
      this.tasks.get(task.id)?.stop();
    }

    const scheduled = cron.schedule(task.expression, () => {
      console.log(`Executing scheduled task: ${task.name}`);
      task.action();
    });

    this.tasks.set(task.id, scheduled);
  }

  stop(id: string) {
    this.tasks.get(id)?.stop();
    this.tasks.delete(id);
  }
}
