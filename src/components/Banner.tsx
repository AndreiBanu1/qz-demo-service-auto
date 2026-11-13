import { copy } from '../copy';

export function Banner() {
  return (
    <div className="bg-amber-400 px-4 py-2 text-center text-sm font-medium text-slate-900">
      <a href={copy.banner.href} className="underline" target="_blank" rel="noopener noreferrer">
        {copy.banner.text}
      </a>
    </div>
  );
}
