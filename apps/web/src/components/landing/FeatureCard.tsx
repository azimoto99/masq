import type { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
}

export function FeatureCard({ icon, title, description, badge }: FeatureCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/65 p-5 shadow-[0_14px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent opacity-70" />
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300/10 text-cyan-200 transition group-hover:border-cyan-200/60 group-hover:text-cyan-100">
        {icon}
      </div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {badge ? (
          <span className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.13em] text-emerald-200">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </article>
  );
}

