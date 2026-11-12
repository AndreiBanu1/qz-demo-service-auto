import type { Deps } from '../deps';
import { json } from '../http';
import { runReminders } from '../jobs';

export async function runRemindersNow(_req: Request, deps: Deps): Promise<Response> {
  return json(await runReminders(deps, 'buton'));
}
