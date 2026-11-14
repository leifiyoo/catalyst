import { SchedulerService } from './index';

export const createDefaultTasks = (scheduler: SchedulerService, server: any) => {
  scheduler.schedule({
    id: 'daily-restart',
    name: 'Daily Restart',
    expression: '0 4 * * *', // 4 AM daily
    action: () => server.restart(),
    enabled: true
  });

  scheduler.schedule({
    id: 'world-backup',
    name: 'Timed Command (Broadcast)',
    expression: '*/30 * * * *',
    action: () => server.sendCommand('say Scheduled maintenance check starting...'),
    enabled: true
  });
};
