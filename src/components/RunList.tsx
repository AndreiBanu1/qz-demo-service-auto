import type { Run, RunItem } from '../../core/types';
import { copy } from '../copy';
import { formatBucharest } from '../format';

const RESULT_STYLE: Record<Run['result'], string> = {
  ok: 'bg-lime-400 text-neutral-950',
  eroare: 'bg-red-400 text-neutral-950',
  'nimic-de-trimis': 'bg-neutral-600 text-white',
};

function outcomeLabel(item: RunItem): string {
  if (item.channel === 'sms-simulat' && item.outcome === 'simulat') return copy.runs.smsSimulated;
  return copy.runs.outcomes[item.outcome];
}

function ItemLine({ item }: { item: RunItem }) {
  return (
    <li className="rounded-lg bg-neutral-800 px-3 py-2 text-sm leading-snug">
      <p className="font-semibold text-white">{item.subject}</p>
      <p className="break-all text-neutral-300">
        {copy.runs.channels[item.channel]} · {item.to}
      </p>
      <p className={item.outcome === 'eroare' ? 'font-medium text-red-300' : 'font-medium text-lime-300'}>
        <span>{outcomeLabel(item)}</span>
        {item.error ? <span className="text-neutral-300"> ({item.error})</span> : null}
      </p>
    </li>
  );
}

export function RunList({ runs }: { runs: Run[] }) {
  if (runs.length === 0) return <p className="text-neutral-300">{copy.automations.empty}</p>;
  return (
    <ul className="space-y-3">
      {runs.map((run) => (
        <li key={run.id} className="rounded-2xl border border-neutral-700 bg-neutral-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold leading-tight text-white">{copy.runs.jobs[run.job]}</h3>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${RESULT_STYLE[run.result]}`}>
              {copy.runs.results[run.result]}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-300">
            <span>{copy.runs.triggers[run.trigger]}</span> · <time dateTime={run.startedAt}>{formatBucharest(run.startedAt)}</time>{' '}
            · {copy.runs.duration(run.durationMs)}
          </p>
          {run.error ? <p className="mt-2 text-sm text-red-300">{run.error}</p> : null}
          {run.items.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {run.items.map((item, i) => (
                <ItemLine key={i} item={item} />
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
