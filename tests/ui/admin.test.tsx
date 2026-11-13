import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Admin } from '../../src/pages/Admin';

const appointment = {
  id: 'a1',
  token: 'tok1',
  firstName: 'Ion',
  email: 'ion@turbo-garaj.test',
  car: { make: 'Dacia', model: 'Logan' },
  work: 'revizie',
  preferredDate: '2026-11-20',
  status: 'primita',
  createdAt: '2026-11-12T08:00:00.000Z',
  updatedAt: '2026-11-12T08:00:00.000Z',
  seed: false,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mockApi(extra?: (url: string, method: string) => Response | Promise<Response> | undefined) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const custom = extra?.(url, method);
    if (custom) return custom;
    if (url === '/api/session') return json({ admin: true });
    if (url === '/api/appointments' && method === 'GET') return json([appointment]);
    if (url === '/api/outbox') return json({ messages: [], used: 3, cap: 40 });
    if (url === '/api/log') return json([]);
    return json({ error: 'Pagina nu există.' }, 404);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const calls = (fn: ReturnType<typeof mockApi>, method: string, url: string) =>
  fn.mock.calls.filter(([u, init]) => String(u) === url && (init?.method ?? 'GET') === method);

afterEach(() => vi.unstubAllGlobals());

const renderAdmin = () =>
  render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );

describe('Admin', () => {
  it('run now button disables while running', async () => {
    const fn = mockApi((url, method) =>
      url === '/api/run-reminders' && method === 'POST' ? new Promise<Response>(() => {}) : undefined,
    );
    renderAdmin();
    const button = await screen.findByRole('button', { name: 'Rulează acum' });
    fireEvent.click(button);
    const running = await screen.findByRole('button', { name: 'Rulează…' });
    expect(running).toBeDisabled();
    fireEvent.click(running);
    expect(calls(fn, 'POST', '/api/run-reminders')).toHaveLength(1);
  });

  it('status change calls PATCH with the new status', async () => {
    const fn = mockApi((url, method) =>
      url === '/api/appointments/a1' && method === 'PATCH'
        ? json({ appointment: { ...appointment, status: 'gata' } })
        : undefined,
    );
    renderAdmin();
    const select = await screen.findByLabelText('Status pentru Ion');
    fireEvent.change(select, { target: { value: 'gata' } });
    await waitFor(() => expect(calls(fn, 'PATCH', '/api/appointments/a1')).toHaveLength(1));
    expect(JSON.parse(String(calls(fn, 'PATCH', '/api/appointments/a1')[0][1]?.body))).toEqual({ status: 'gata' });
  });

  it('logged out shows the password form and the server error', async () => {
    mockApi((url, method) => {
      if (url === '/api/session') return json({ admin: false });
      if (url === '/api/login' && method === 'POST') return json({ error: 'Parolă greșită.' }, 401);
      return undefined;
    });
    renderAdmin();
    fireEvent.change(await screen.findByLabelText('Parola'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Intră în cont' }));
    expect(await screen.findByText('Parolă greșită.')).toBeInTheDocument();
  });

  it('delete asks for confirmation first', async () => {
    const fn = mockApi((url, method) => (method === 'DELETE' ? new Response(null, { status: 204 }) : undefined));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAdmin();
    fireEvent.click(await screen.findByRole('button', { name: 'Șterge clientul' }));
    expect(confirm).toHaveBeenCalled();
    expect(calls(fn, 'DELETE', '/api/appointments/a1')).toHaveLength(0);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Șterge clientul' }));
    await waitFor(() => expect(calls(fn, 'DELETE', '/api/appointments/a1')).toHaveLength(1));
    confirm.mockRestore();
  });

  it('shows the preferred date in Romanian', async () => {
    mockApi();
    renderAdmin();
    expect(await screen.findByText(/20 noiembrie 2026/)).toBeInTheDocument();
  });

  it('shows the email budget', async () => {
    mockApi();
    renderAdmin();
    expect(await screen.findByText('3 din 40 emailuri de test folosite luna asta')).toBeInTheDocument();
  });
});

describe('Admin polling', () => {
  const logCalls = (fn: ReturnType<typeof mockApi>) => calls(fn, 'GET', '/api/log').length;
  const setVisibility = (v: 'visible' | 'hidden') =>
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(v);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const tick = async (ms: number) => {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('polls the log every 3000 ms while visible', async () => {
    const fn = mockApi();
    renderAdmin();
    await screen.findByRole('button', { name: 'Rulează acum' });
    const before = logCalls(fn);
    await tick(3000);
    expect(logCalls(fn)).toBe(before + 1);
    await tick(3000);
    expect(logCalls(fn)).toBe(before + 2);
  });

  it('does not poll while the page is hidden and catches up when visible again', async () => {
    const fn = mockApi();
    renderAdmin();
    await screen.findByRole('button', { name: 'Rulează acum' });
    const vis = setVisibility('hidden');
    const before = logCalls(fn);
    await tick(9000);
    expect(logCalls(fn)).toBe(before);
    vis.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(logCalls(fn)).toBe(before + 1);
  });

  it('stops polling after unmount', async () => {
    const fn = mockApi();
    const { unmount } = renderAdmin();
    await screen.findByRole('button', { name: 'Rulează acum' });
    unmount();
    const before = logCalls(fn);
    await tick(9000);
    expect(logCalls(fn)).toBe(before);
  });

  it('a failed poll shows no error once the next poll succeeds', async () => {
    let failNext = false;
    mockApi((url) => (url === '/api/log' && failNext ? json({ error: 'Ceva n-a mers. Încearcă din nou.' }, 500) : undefined));
    renderAdmin();
    await screen.findByRole('button', { name: 'Rulează acum' });
    failNext = true;
    await tick(3000);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    failNext = false;
    await tick(3000);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a 401 during polling returns to the login form', async () => {
    let expired = false;
    mockApi((url) => {
      if (url === '/api/log' && expired) return json({ error: 'Intră în cont ca administrator.' }, 401);
      if (url === '/api/session' && expired) return json({ admin: false });
      return undefined;
    });
    renderAdmin();
    await screen.findByRole('button', { name: 'Rulează acum' });
    expired = true;
    await tick(3000);
    expect(await screen.findByLabelText('Parola')).toBeInTheDocument();
  });
});
