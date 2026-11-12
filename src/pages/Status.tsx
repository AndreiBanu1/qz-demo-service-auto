import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { STATUS_LABELS, WORK_LABELS } from '../../core/booking';
import { getStatus, type PublicStatus } from '../api';
import { StatusTimeline } from '../components/StatusTimeline';
import { copy } from '../copy';
import { formatBucharest } from '../format';
import { card } from '../ui';

export function Status() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    getStatus(token)
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [token]);

  if (error) return <p className="text-2xl font-bold text-white">{error}</p>;
  if (!data) return <p>{copy.loading}</p>;

  const c = copy.status;
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-lg text-neutral-200">{c.hello(data.firstName)}</p>
        <h1 className="text-4xl font-extrabold leading-tight text-white">
          {data.status === 'gata' ? c.ready : STATUS_LABELS[data.status]}
        </h1>
      </header>

      <section aria-label={c.timeline}>
        <StatusTimeline status={data.status} />
      </section>

      <dl className={`${card} space-y-3 text-lg`}>
        <div>
          <dt className="text-sm text-neutral-300">{c.car}</dt>
          <dd className="font-semibold text-white">
            {data.car.make} {data.car.model}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-300">{c.work}</dt>
          <dd className="font-semibold text-white">{WORK_LABELS[data.work]}</dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-300">{c.updated}</dt>
          <dd className="font-semibold text-white">{formatBucharest(data.updatedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}
