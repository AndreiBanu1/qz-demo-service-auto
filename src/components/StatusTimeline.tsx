import { STATUS_LABELS } from '../../core/booking';
import type { Status } from '../../core/types';

const ORDER: Status[] = ['primita', 'in-lucru', 'gata', 'predata'];

export function StatusTimeline({ status }: { status: Status }) {
  const current = ORDER.indexOf(status);
  return (
    <ol className="space-y-0">
      {ORDER.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-stretch gap-4" aria-current={active ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-6 w-6 shrink-0 rounded-full border-2 ${
                  active ? 'border-lime-400 bg-lime-400' : done ? 'border-lime-400 bg-lime-400/40' : 'border-neutral-600'
                }`}
                aria-hidden="true"
              />
              {i < ORDER.length - 1 ? (
                <span className={`w-0.5 flex-1 ${done ? 'bg-lime-400/60' : 'bg-neutral-700'}`} aria-hidden="true" />
              ) : null}
            </div>
            <p className={`pb-6 text-xl ${active ? 'font-bold text-white' : done ? 'text-neutral-200' : 'text-neutral-500'}`}>
              {STATUS_LABELS[s]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
