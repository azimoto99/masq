import type { ReactNode } from 'react';

interface MockPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function MockPanel({ title, subtitle, children, className }: MockPanelProps) {
  return (
    <article className={`landing-gradient-ring overflow-hidden rounded-2xl p-[1px] ${className ?? ''}`}>
      <div className="relative h-full rounded-2xl bg-slate-950/90 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">
            Concept
          </span>
        </div>
        {children}
      </div>
    </article>
  );
}

