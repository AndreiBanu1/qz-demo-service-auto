import { Link } from 'react-router-dom';
import { WORK_LABELS } from '../../core/booking';
import { copy } from '../copy';
import { btnPrimary, card } from '../ui';

export function Home() {
  const c = copy.home;
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-extrabold leading-tight text-white">{c.title}</h1>
        <p className="text-lg text-neutral-200">{c.lead}</p>
        <Link to="/programare" className={btnPrimary}>
          {c.book}
        </Link>
      </section>

      <section aria-labelledby="services">
        <h2 id="services" className="mb-3 text-2xl font-bold text-white">
          {c.servicesTitle}
        </h2>
        <ul className="grid grid-cols-1 gap-2">
          {Object.values(WORK_LABELS).map((name) => (
            <li key={name} className={`${card} py-4 text-xl font-semibold text-white`}>
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="mb-3 text-2xl font-bold text-white">
          {c.howTitle}
        </h2>
        <ol className="space-y-3">
          {c.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-400 text-xl font-extrabold text-neutral-950">
                {i + 1}
              </span>
              <span className="text-lg text-neutral-100">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <p>
        <Link to="/automatizari" className="text-lg font-semibold text-lime-300 underline">
          {c.seeRuns}
        </Link>
      </p>

      <aside className="rounded-2xl border-2 border-amber-400 p-5 text-lg text-neutral-100">
        <p>{c.notReal}</p>
        <a href={copy.banner.href} className="mt-2 inline-block font-semibold text-amber-300 underline" target="_blank" rel="noopener noreferrer">
          {c.notRealLink}
        </a>
      </aside>
    </div>
  );
}
