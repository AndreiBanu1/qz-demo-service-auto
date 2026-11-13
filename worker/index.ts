import { type Deps, type Env, createDeps } from './deps';
import { fail, withHeaders } from './http';
import { route } from './router';
import { handleScheduled } from './scheduled';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname !== '/api' && !pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      // Booking and car-ready emails finish after the response (see Deps.background).
      const deps: Deps = { ...createDeps(env), background: (job) => ctx.waitUntil(job) };
      return withHeaders(await route(req, deps));
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
