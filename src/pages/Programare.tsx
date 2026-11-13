import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { WORK_LABELS } from '../../core/booking';
import type { Work } from '../../core/types';
import { todayInBucharest } from '../../core/dates';
import { isTestAddress } from '../../core/recipients';
import { createAppointment, getSession } from '../api';
import { copy } from '../copy';
import { btnPrimary, card, errorText, field, label } from '../ui';

type Outcome = { kind: 'demo' } | { kind: 'saved'; token: string } | { kind: 'error'; message: string } | null;

export function Programare() {
  const c = copy.booking;
  const today = todayInBucharest(new Date());
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [work, setWork] = useState<Work>('revizie');
  const [preferredDate, setPreferredDate] = useState(today);
  const [itpExpiry, setItpExpiry] = useState('');
  const [lastOilChange, setLastOilChange] = useState('');
  const [remindersAccepted, setRemindersAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setOutcome(null);
    if (!isTestAddress(email)) {
      setOutcome({ kind: 'error', message: c.emailHint });
      return;
    }
    setBusy(true);
    try {
      // Strangers never store anything: only an admin session may POST.
      const { admin } = await getSession();
      if (!admin) {
        setOutcome({ kind: 'demo' });
        return;
      }
      const { appointment } = await createAppointment({
        firstName,
        email,
        make,
        model,
        work,
        preferredDate,
        itpExpiry: itpExpiry || undefined,
        lastOilChange: lastOilChange || undefined,
        remindersAccepted,
      });
      setOutcome({ kind: 'saved', token: appointment.token });
    } catch (err) {
      setOutcome({ kind: 'error', message: err instanceof Error ? err.message : copy.genericError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <h1 className="text-3xl font-extrabold text-white">{c.title}</h1>

      <div>
        <label htmlFor="firstName" className={label}>{c.firstName}</label>
        <input id="firstName" className={field} value={firstName} onChange={(e) => setFirstName(e.target.value)} required minLength={2} maxLength={40} autoComplete="given-name" />
      </div>
      <div>
        <label htmlFor="email" className={label}>{c.email}</label>
        <input id="email" type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={c.emailPlaceholder} required aria-describedby="email-hint" />
        <p id="email-hint" className="mt-1 text-sm text-neutral-300">{c.emailHint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="make" className={label}>{c.make}</label>
          <input id="make" className={field} value={make} onChange={(e) => setMake(e.target.value)} placeholder={c.makePlaceholder} required />
        </div>
        <div>
          <label htmlFor="model" className={label}>{c.model}</label>
          <input id="model" className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder={c.modelPlaceholder} required />
        </div>
      </div>
      <div>
        <label htmlFor="work" className={label}>{c.work}</label>
        <select id="work" className={field} value={work} onChange={(e) => setWork(e.target.value as Work)}>
          {Object.entries(WORK_LABELS).map(([value, text]) => (
            <option key={value} value={value}>{text}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="preferredDate" className={label}>{c.date}</label>
        <input id="preferredDate" type="date" className={field} value={preferredDate} min={today} onChange={(e) => setPreferredDate(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="itpExpiry" className={label}>{c.itp}</label>
        <input id="itpExpiry" type="date" className={field} value={itpExpiry} onChange={(e) => setItpExpiry(e.target.value)} />
      </div>
      <div>
        <label htmlFor="lastOilChange" className={label}>{c.oil}</label>
        <input id="lastOilChange" type="date" className={field} value={lastOilChange} onChange={(e) => setLastOilChange(e.target.value)} />
      </div>
      <label htmlFor="reminders" className="flex min-h-12 items-center gap-3 text-lg text-white">
        <input id="reminders" type="checkbox" className="h-6 w-6 accent-lime-400" checked={remindersAccepted} onChange={(e) => setRemindersAccepted(e.target.checked)} />
        {c.reminders}
      </label>

      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy ? c.sending : c.submit}
      </button>

      <div role="status" aria-live="polite">
        {outcome?.kind === 'demo' ? <p className={`${card} text-lg font-semibold text-amber-300`}>{c.demoNotice}</p> : null}
        {outcome?.kind === 'error' ? <p className={errorText}>{outcome.message}</p> : null}
        {outcome?.kind === 'saved' ? (
          <p className={`${card} text-lg text-white`}>
            {c.saved}{' '}
            <Link to={`/status/${outcome.token}`} className="font-semibold text-lime-300 underline">
              {c.openStatus}
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}
