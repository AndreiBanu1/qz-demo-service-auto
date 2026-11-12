export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MAIL_MODE: 'sandbox' | 'memory';
  SITE_URL: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
