import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_LABELS, WORK_LABELS } from '../../core/booking';
import { formatDateRo } from '../../core/format';
import type { Appointment, OutboxMessage, Run, Status } from '../../core/types';
import { ApiError, api } from '../api';
import { RunList } from '../components/RunList';
import { copy } from '../copy';
import { btnDanger, btnPrimary, btnSecondary, card, errorText, field, label } from '../ui';

const POLL_MS = 3000;

function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-3xl font-extrabold text-white">{copy.admin.title}</h1>
      <div>
        <label htmlFor="password" className={label}>{copy.admin.password}</label>
        <input id="password" type="password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {error ? <p role="alert" className={errorText}>{error}</p> : null}
      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy ? copy.admin.loggingIn : copy.admin.login}
      </button>
    </form>
  );
}

function Dashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const c = copy.admin;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [outbox, setOutbox] = useState<{ messages: OutboxMessage[]; used: number; cap: number } | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) return onLoggedOut();
      setError(err instanceof Error ? err.message : copy.genericError);
    },
    [onLoggedOut],
  );

  const refreshLive = useCallback(
    () => Promise.all([api.getLog().then(setRuns), api.getOutbox().then(setOutbox)]),
    [],
  );
  const refreshAll = useCallback(
    () => Promise.all([api.listAppointments().then(setAppointments), refreshLive()]).catch(fail),
    [fail, refreshLive],
  );

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Poll the log while the page is visible; catch up as soon as it becomes visible again.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      // A dropped poll must not leave an error on screen; the next one recovers.
      // Only an expired session matters.
      refreshLive().catch((err) => {
        if (err instanceof ApiError && err.status === 401) onLoggedOut();
      });
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshLive, onLoggedOut]);

  async function guarded(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await refreshAll();
    } catch (err) {
      fail(err);
    }
  }

  async function runNow() {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    await guarded(() => api.runReminders());
    runningRef.current = false;
    setRunning(false);
  }

  const reset = () => {
    if (window.confirm(c.confirmReset)) void guarded(() => api.resetDemo());
  };
  const remove = (a: Appointment) => {
    if (window.confirm(c.confirmDelete(a.firstName))) void guarded(() => api.deleteAppointment(a.id));
  };
  const logout = async () => {
    try {
      await api.logout();
    } finally {
      onLoggedOut();
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-white">{c.title}</h1>
        <button type="button" className={btnSecondary} onClick={logout}>{c.logout}</button>
      </header>

      {error ? <p role="alert" className={errorText}>{error}</p> : null}

      <div className="grid grid-cols-1 gap-3">
        <button type="button" className={btnPrimary} onClick={runNow} disabled={running}>
          {running ? c.running : c.runNow}
        </button>
        <button type="button" className={btnDanger} onClick={reset}>{c.reset}</button>
      </div>

      <section aria-labelledby="bookings" className="space-y-3">
        <h2 id="bookings" className="text-2xl font-bold text-white">{c.bookingsTitle}</h2>
        {appointments.length === 0 ? <p className="text-neutral-300">{c.noBookings}</p> : null}
        <ul className="space-y-3">
          {appointments.map((a) => (
            <li key={a.id} className={`${card} space-y-3`}>
              <div>
                <p className="text-xl font-bold text-white">{a.firstName}</p>
                <p className="text-neutral-200">
                  {a.car.make} {a.car.model} · {WORK_LABELS[a.work]} · {formatDateRo(a.preferredDate)}
                </p>
              </div>
              <select
                aria-label={c.statusFor(a.firstName)}
                className={field}
                value={a.status}
                onChange={(e) => void guarded(() => api.updateStatus(a.id, e.target.value as Status))}
              >
                {Object.entries(STATUS_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>{text}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-3">
                <Link to={`/status/${a.token}`} className={btnSecondary}>{c.statusPage}</Link>
                <button type="button" className={btnDanger} onClick={() => remove(a)}>{c.deleteCustomer}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="live" className="space-y-3">
        <h2 id="live" className="text-2xl font-bold text-white">{c.liveTitle}</h2>
        <RunList runs={runs} />
      </section>

      <section aria-labelledby="outbox" className="space-y-3">
        <h2 id="outbox" className="text-2xl font-bold text-white">{c.outboxTitle}</h2>
        {outbox ? <p className="font-semibold text-lime-300">{c.budget(outbox.used, outbox.cap)}</p> : null}
        {outbox && outbox.messages.length === 0 ? <p className="text-neutral-300">{c.noOutbox}</p> : null}
        <ul className="space-y-3">
          {outbox?.messages.map((m) => (
            <li key={m.id} className={card}>
              <p className="text-sm text-neutral-300">
                {copy.runs.channels[m.channel]} · {m.to} · {m.channel === 'sms-simulat' && m.outcome === 'simulat' ? copy.runs.smsSimulated : copy.runs.outcomes[m.outcome]}
              </p>
              <p className="mt-1 text-lg font-bold text-white">{m.subject}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-neutral-100">{m.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Admin() {
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getSession()
      .then((s) => setAdmin(s.admin))
      .catch(() => setAdmin(false));
  }, []);

  const loggedOut = useCallback(() => setAdmin(false), []);
  if (admin === null) return <p>{copy.loading}</p>;
  return admin ? <Dashboard onLoggedOut={loggedOut} /> : <Login onLoggedIn={() => setAdmin(true)} />;
}
