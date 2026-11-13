import type { BookingInput } from '../core/booking';
import type { Appointment, OutboxMessage, Run, Status, Work } from '../core/types';
import { copy } from './copy';

/** An API failure. `message` is the Romanian text the server sent. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiError(copy.genericError);
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON: fall through to the generic message below.
  }
  if (!res.ok) {
    const message = (data as { error?: unknown } | null)?.error;
    throw new ApiError(typeof message === 'string' ? message : copy.genericError, res.status);
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export type PublicStatus = {
  firstName: string;
  car: { make: string; model: string };
  work: Work;
  status: Status;
  updatedAt: string;
};

export const api = {
  getSession: () => request<{ admin: boolean }>('/api/session'),
  login: (password: string) => post<{ admin: boolean }>('/api/login', { password }),
  logout: () => post<{ admin: boolean }>('/api/logout'),
  listAppointments: () => request<Appointment[]>('/api/appointments'),
  createAppointment: (input: BookingInput) =>
    post<{ appointment: Appointment; statusUrl: string; run: Run }>('/api/appointments', input),
  updateStatus: (id: string, status: Status) =>
    request<{ appointment: Appointment; run?: Run }>(`/api/appointments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteAppointment: (id: string) =>
    request<void>(`/api/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getStatus: (token: string) => request<PublicStatus>(`/api/status/${encodeURIComponent(token)}`),
  runReminders: () => post<Run>('/api/run-reminders'),
  resetDemo: () => post<Run>('/api/reset'),
  getOutbox: () => request<{ messages: OutboxMessage[]; used: number; cap: number }>('/api/outbox'),
  getLog: () => request<Run[]>('/api/log'),
};

export const {
  getSession,
  login,
  logout,
  listAppointments,
  createAppointment,
  updateStatus,
  deleteAppointment,
  getStatus,
  runReminders,
  resetDemo,
  getOutbox,
  getLog,
} = api;
