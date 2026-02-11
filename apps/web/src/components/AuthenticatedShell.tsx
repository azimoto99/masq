import type { MeResponse } from '@masq/shared';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

interface AuthenticatedShellProps {
  me: MeResponse;
  onLogout: () => Promise<void>;
  children: ReactNode;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';

interface NavItem {
  to: string;
  label: string;
  testId?: string;
}

const utilityItems: readonly NavItem[] = [
  { to: '/home', label: 'Home' },
  { to: '/masks', label: 'Masks' },
];

const switchItems: readonly NavItem[] = [
  { to: '/servers', label: 'Servers' },
  { to: '/friends', label: 'Friends' },
  { to: '/dm', label: 'DMs' },
  { to: '/rooms', label: 'Rooms', testId: 'open-rooms-button' },
];

export function AuthenticatedShell({ me, onLogout, children }: AuthenticatedShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const persistedMaskId = window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY);
  const activeMask = me.masks.find((mask) => mask.id === persistedMaskId) ?? me.masks[0] ?? null;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <div className="mx-auto w-full max-w-[1520px] space-y-4">
      <header className="masq-surface rounded-3xl border border-ink-700 bg-ink-800/90 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/home" className="rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5">
              <BrandLogo className="h-7 w-auto select-none" />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Masq</p>
              <p className="text-sm text-slate-300">{me.user.email}</p>
            </div>
            <nav className="hidden items-center gap-1.5 lg:flex">
              {utilityItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                    isActive(item.to)
                      ? 'masq-focus-ring border-neon-400/45 bg-neon-400/10 text-neon-100'
                      : 'border-ink-700 bg-ink-900/75 text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex-1 basis-full lg:basis-auto">
            <div className="rounded-lg border border-ink-700 bg-ink-900/75 px-2 py-1.5">
              <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">Switch</p>
              <nav className="flex flex-wrap items-center gap-1.5">
                {switchItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-testid={item.testId}
                    className={`rounded-md border px-2.5 py-1 text-xs uppercase tracking-[0.12em] transition ${
                      isActive(item.to)
                        ? 'masq-focus-ring border-neon-400/45 bg-neon-400/10 text-neon-100'
                        : 'border-ink-700 bg-ink-900/75 text-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-md border border-ink-700 bg-ink-900/80 px-2 py-1">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Active Mask</p>
              <p className="flex items-center gap-1.5 text-xs text-slate-200">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: activeMask?.color ?? '#78e6da' }}
                />
                {activeMask?.displayName ?? 'none'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              disabled={loggingOut}
              className="rounded-md border border-ink-700 px-2.5 py-1 text-xs uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
