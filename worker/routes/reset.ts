import type { Deps } from '../deps';
import { json } from '../http';
import { cleanup } from '../jobs';

export async function reset(_req: Request, deps: Deps): Promise<Response> {
  return json(await cleanup(deps, 'buton', 'reset'));
}
