import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { listRuns } from '../../worker/db';
import { handleScheduled } from '../../worker/index';
import { cleanup } from '../../worker/jobs';
import { testDeps } from './helpers';

async function fire(cron: string, deps = testDeps()) {
  const controller = createScheduledController({ cron, scheduledTime: Date.now() });
  const ctx = createExecutionContext();
  ctx.waitUntil(handleScheduled(controller.cron, deps));
  await waitOnExecutionContext(ctx);
  return deps;
}

describe('scheduled', () => {
  it('0 5 cron runs reminders', async () => {
    const deps = testDeps();
    await cleanup(deps, 'buton', 'reset');
    await fire('0 5 * * *', deps);
    const runs = await listRuns(deps.db, 50);
    expect(runs.some((r) => r.job === 'remindere-zilnice' && r.trigger === 'cron')).toBe(true);
  });

  it('0 2 cron runs cleanup', async () => {
    const deps = await fire('0 2 * * *');
    const runs = await listRuns(deps.db, 50);
    expect(runs.some((r) => r.job === 'curatenie' && r.trigger === 'cron')).toBe(true);
  });

  it('an unknown cron does nothing', async () => {
    const deps = await fire('1 1 * * *');
    expect(await listRuns(deps.db, 50)).toHaveLength(0);
  });
});
