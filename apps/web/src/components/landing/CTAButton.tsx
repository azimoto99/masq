import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type CTAButtonVariant = 'primary' | 'secondary' | 'live';

interface CTAButtonProps {
  children: ReactNode;
  variant?: CTAButtonVariant;
  className?: string;
  to?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const variantClassNames: Record<CTAButtonVariant, string> = {
  primary:
    'border-cyan-300/50 bg-cyan-300/15 text-cyan-50 hover:border-cyan-200 hover:bg-cyan-300/25',
  secondary:
    'border-slate-600/80 bg-slate-900/70 text-slate-200 hover:border-slate-400 hover:text-white',
  live:
    'border-emerald-300/45 bg-emerald-300/15 text-emerald-100 hover:border-emerald-200 hover:bg-emerald-300/25',
};

export function CTAButton({ children, variant = 'primary', className, to, href, onClick }: CTAButtonProps) {
  const baseClassName = `inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold tracking-[0.02em] transition ${variantClassNames[variant]} ${className ?? ''}`;

  if (to) {
    return (
      <Link to={to} className={baseClassName}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={baseClassName}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClassName}>
      {children}
    </button>
  );
}

