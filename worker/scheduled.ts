import type { Deps } from './deps';
import { cleanup, runReminders } from './jobs';

export const CRON_REMINDERS = '0 5 * * *';
export const CRON_CLEANUP = '0 2 * * *';

export async function handleScheduled(cron: string, deps: Deps): Promise<void> {
  if (cron === CRON_REMINDERS) await runReminders(deps, 'cron');
  else if (cron === CRON_CLEANUP) await cleanup(deps, 'cron', 'nightly');
}
