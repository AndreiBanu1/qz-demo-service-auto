import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '../copy';
import { Banner } from './Banner';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <Banner />
      <header className="border-b border-neutral-800 px-4 py-3">
        <Link to="/" className="text-xl font-extrabold tracking-tight text-lime-400">
          {copy.brand}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-neutral-800 px-4 py-6 text-center text-base text-neutral-300">
        <Link to="/confidentialitate" className="mx-3 inline-block py-2 underline">
          {copy.footer.privacy}
        </Link>
        <Link to="/automatizari" className="mx-3 inline-block py-2 underline">
          {copy.footer.automations}
        </Link>
      </footer>
    </div>
  );
}
