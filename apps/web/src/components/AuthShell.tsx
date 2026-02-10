import type { ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-ink-700 bg-ink-800/85 p-8 shadow-2xl shadow-black/40">
      <BrandLogo />
      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Masq Access</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>

      <div className="mt-7">{children}</div>

      {footer ? <div className="mt-6 text-sm text-slate-400">{footer}</div> : null}
    </div>
  );
}
