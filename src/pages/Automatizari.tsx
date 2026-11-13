import { useEffect, useState } from 'react';
import type { Job, Run } from '../../core/types';
import { getLog } from '../api';
import { RunList } from '../components/RunList';
import { copy } from '../copy';
import { errorText } from '../ui';

const JOBS: Job[] = ['confirmare-programare', 'masina-gata', 'remindere-zilnice', 'curatenie'];

export function Automatizari() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getLog()
      .then((r) => live && setRuns(r))
      .catch((e: Error) => live && setError(e.message || copy.automations.loadError));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white">{copy.automations.title}</h1>
        <p className="text-lg text-neutral-200">{copy.automations.lead}</p>
      </header>

      <section aria-labelledby="jobs" className="space-y-4">
        <h2 id="jobs" className="text-2xl font-bold text-white">
          {copy.automations.jobsTitle}
        </h2>
        {JOBS.map((job) => (
          <div key={job}>
            <h3 className="text-lg font-bold text-lime-300">{copy.runs.jobs[job]}</h3>
            <p className="text-lg text-neutral-100">{copy.automations.jobs[job]}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="runs" className="space-y-3">
        <h2 id="runs" className="text-2xl font-bold text-white">
          {copy.automations.runsTitle}
        </h2>
        {error ? <p className={errorText}>{error}</p> : runs ? <RunList runs={runs} /> : <p>{copy.loading}</p>}
      </section>
    </div>
  );
}
