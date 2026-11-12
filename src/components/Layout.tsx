import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '../copy';
import { Banner } from './Banner';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Banner />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-600">
        <Link to="/confidentialitate" className="mx-3 underline">
          {copy.footer.privacy}
        </Link>
        <Link to="/automatizari" className="mx-3 underline">
          {copy.footer.automations}
        </Link>
      </footer>
    </div>
  );
}
