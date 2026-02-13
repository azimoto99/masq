import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type CTAButtonVariant = 'primary' | 'secondary' | 'live';

interface CTAButtonProps {
  children: ReactNode;
  variant?: CTAButtonVariant;
  className?: string;
  to?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
}

const variantClassNames: Record<CTAButtonVariant, string> = {
  primary:
    'landing-cta-sheen border-cyan-300/55 bg-cyan-300/16 text-cyan-50 shadow-[0_14px_30px_rgba(34,211,238,0.2)] hover:border-cyan-200 hover:bg-cyan-300/24',
  secondary:
    'border-slate-600/75 bg-slate-900/75 text-slate-200 hover:border-slate-400 hover:text-white',
  live:
    'border-emerald-300/45 bg-emerald-300/14 text-emerald-100 hover:border-emerald-200 hover:bg-emerald-300/22',
};

export function CTAButton({ children, variant = 'primary', className, to, href, onClick }: CTAButtonProps) {
  const baseClassName = `inline-flex items-center justify-center rounded-[0.9rem] border px-4 py-2 text-sm font-semibold tracking-[0.02em] transition ${variantClassNames[variant]} ${className ?? ''}`;

  if (to) {
    return (
      <Link to={to} className={baseClassName} onClick={onClick as MouseEventHandler<HTMLAnchorElement> | undefined}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={baseClassName} onClick={onClick as MouseEventHandler<HTMLAnchorElement> | undefined}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick as MouseEventHandler<HTMLButtonElement> | undefined} className={baseClassName}>
      {children}
    </button>
  );
}
