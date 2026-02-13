import type { ReactNode } from 'react';

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

export function Section({ id, eyebrow, title, subtitle, className, children }: SectionProps) {
  return (
    <section id={id} className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className ?? ''}`}>
      {eyebrow || title || subtitle ? (
        <header className="mb-8 max-w-3xl sm:mb-10">
          {eyebrow ? (
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">{eyebrow}</p>
          ) : null}
          {title ? <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h2> : null}
          {subtitle ? <p className="mt-3 text-sm text-slate-300 sm:text-base">{subtitle}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

