import type { MeResponse } from '@masq/shared';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { SpacesSidebar } from './SpacesSidebar';

interface AuthenticatedShellProps {
  me: MeResponse;
  onLogout: () => Promise<void>;
  children: ReactNode;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';
const MOBILE_NAV_ITEMS: Array<{ label: string; to: string }> = [
  { label: 'Home', to: '/home' },
  { label: 'Servers', to: '/servers' },
  { label: 'Friends', to: '/friends' },
  { label: 'DMs', to: '/dm' },
  { label: 'Rooms', to: '/rooms' },
  { label: 'Masks', to: '/masks' },
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

  const showGlobalSpacesSidebar =
    !location.pathname.startsWith('/servers') &&
    (location.pathname.startsWith('/friends') ||
      location.pathname.startsWith('/dm') ||
      location.pathname.startsWith('/rooms') ||
      location.pathname.startsWith('/masks') ||
      location.pathname.startsWith('/home'));

  const isMobileNavActive = (path: string) =>
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
            <Link
              to="/masks"
              className="rounded-md border border-ink-700 px-2.5 py-1 text-xs uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Masks
            </Link>
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
      <nav className="lg:hidden rounded-2xl border border-ink-700 bg-ink-900/70 p-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {MOBILE_NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition ${
                isMobileNavActive(item.to)
                  ? 'border-neon-400/50 bg-neon-400/10 text-neon-100'
                  : 'border-ink-700 bg-ink-900 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      {showGlobalSpacesSidebar ? (
        <>
          <details className="lg:hidden rounded-2xl border border-ink-700 bg-ink-900/70 p-3">
            <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.16em] text-slate-300">
              Open Spaces
            </summary>
            <div className="mt-3">
              <SpacesSidebar />
            </div>
          </details>
          <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
            <SpacesSidebar className="hidden lg:block lg:sticky lg:top-4 lg:h-[calc(100vh-3rem)] lg:overflow-hidden" />
            <div>{children}</div>
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
