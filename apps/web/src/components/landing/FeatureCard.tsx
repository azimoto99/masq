import type { MouseEventHandler, ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  href: string;
  onLearnMore?: MouseEventHandler<HTMLAnchorElement>;
}

export function FeatureCard({ icon, title, description, badge, href, onLearnMore }: FeatureCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-[1.05rem] border border-slate-700/65 bg-slate-900/60 p-5 shadow-[0_14px_30px_rgba(0,0,0,0.26)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent opacity-80" />
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
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
      <a
        href={href}
        onClick={onLearnMore}
        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200 transition hover:text-cyan-100"
      >
        Learn more
        <span aria-hidden="true" className="text-[11px]">
          /
        </span>
      </a>
    </article>
  );
}
