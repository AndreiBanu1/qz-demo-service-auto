import { type Deps, type Env, createDeps } from './deps';
import { fail, withHeaders } from './http';
import { cleanup, runReminders } from './jobs';
import { route } from './router';

export const CRON_REMINDERS = '0 5 * * *';
export const CRON_CLEANUP = '0 2 * * *';

export async function handleScheduled(cron: string, deps: Deps): Promise<void> {
  if (cron === CRON_REMINDERS) await runReminders(deps, 'cron');
  else if (cron === CRON_CLEANUP) await cleanup(deps, 'cron', 'nightly');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname !== '/api' && !pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return withHeaders(await route(req, createDeps(env)));
    } catch (e) {
      // Missing secrets or settings: log the cause, keep it out of the response.
      console.error('worker setup error', e);
      return withHeaders(fail(500, 'Ceva n-a mers. Încearcă din nou.'));
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(controller.cron, createDeps(env)));
  },
} satisfies ExportedHandler<Env>;
