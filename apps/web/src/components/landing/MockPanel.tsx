import type { ReactNode } from 'react';

interface MockPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  badgeLabel?: string;
  badgeTone?: 'default' | 'live' | 'privacy';
}

const badgeClassNames: Record<NonNullable<MockPanelProps['badgeTone']>, string> = {
  default: 'border-slate-700/80 bg-slate-900/70 text-slate-400',
  live: 'border-emerald-300/35 bg-emerald-300/12 text-emerald-100',
  privacy: 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100',
};

export function MockPanel({
  title,
  subtitle,
  children,
  className,
  badgeLabel = 'Preview',
  badgeTone = 'default',
}: MockPanelProps) {
  return (
    <article className={`landing-gradient-ring overflow-hidden rounded-[1.1rem] p-[1px] ${className ?? ''}`}>
      <div className="relative h-full rounded-[1.05rem] bg-slate-950/90 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${badgeClassNames[badgeTone]}`}
          >
            {badgeLabel}
          </span>
        </div>
        {children}
      </div>
    </article>
  );
}
