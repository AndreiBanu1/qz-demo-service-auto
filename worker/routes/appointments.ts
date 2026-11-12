import { validateBooking } from '../../core/booking';
import { todayInBucharest } from '../../core/dates';
import type { Status } from '../../core/types';
import { listAppointments } from '../db';
import type { Deps } from '../deps';
import { FORM_ERROR, fail, json, readJson } from '../http';
import { createBooking, deleteCustomer, setStatus, statusUrl } from '../jobs';

const STATUSES: readonly string[] = ['primita', 'in-lucru', 'gata', 'predata'];

export async function list(_req: Request, deps: Deps): Promise<Response> {
  return json(await listAppointments(deps.db));
}

export async function create(req: Request, deps: Deps): Promise<Response> {
  const body = await readJson(req);
  if (body === null) return fail(400, FORM_ERROR);
  const checked = validateBooking(body, todayInBucharest(deps.now()));
  if (!checked.ok) return fail(400, checked.error);
  const { appointment, run } = await createBooking(deps, checked.value);
  return json({ appointment, statusUrl: statusUrl(deps, appointment.token), run }, 201);
}

export async function patch(req: Request, deps: Deps, params: Record<string, string>): Promise<Response> {
  const status = ((await readJson(req)) as { status?: unknown } | null)?.status;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return fail(400, 'Alege un status valid.');
  const result = await setStatus(deps, params.id, status as Status);
  if (!result) return fail(404, 'Programarea nu mai există.');
  return json(result);
}

export async function remove(_req: Request, deps: Deps, params: Record<string, string>): Promise<Response> {
  if (!(await deleteCustomer(deps, params.id))) return fail(404, 'Programarea nu mai există.');
  return new Response(null, { status: 204 });
}
