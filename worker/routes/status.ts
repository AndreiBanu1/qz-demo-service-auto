import { getAppointmentByToken } from '../db';
import type { Deps } from '../deps';
import { fail, json } from '../http';

const TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

/** Public: only what the customer needs, never the email or the internal id. */
export async function status(_req: Request, deps: Deps, params: Record<string, string>): Promise<Response> {
  const a = TOKEN.test(params.token) ? await getAppointmentByToken(deps.db, params.token) : null;
  if (!a) return fail(404, 'Linkul nu mai e valid.');
  return json({ firstName: a.firstName, car: a.car, work: a.work, status: a.status, updatedAt: a.updatedAt });
}
