import { copy } from '../copy';

export function Confidentialitate() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-white">{copy.privacy.title}</h1>
      {copy.privacy.sections.map((s) => (
        <section key={s.heading}>
          <h2 className="mb-1 text-xl font-bold text-lime-300">{s.heading}</h2>
          <p className="text-lg text-neutral-100">{s.text}</p>
        </section>
      ))}
    </div>
  );
}
