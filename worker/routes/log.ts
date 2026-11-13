import type { Deps } from '../deps';
import { json } from '../http';
import { recentRuns } from '../jobs';

/** Public. Run items only ever hold masked addresses. */
export async function log(_req: Request, deps: Deps): Promise<Response> {
  return json(await recentRuns(deps, 50));
}
