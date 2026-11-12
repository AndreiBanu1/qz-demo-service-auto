import type { Deps } from '../deps';
import { json } from '../http';
import { outboxWithBudget } from '../jobs';

export async function outbox(_req: Request, deps: Deps): Promise<Response> {
  return json(await outboxWithBudget(deps));
}
