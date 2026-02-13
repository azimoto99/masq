import type { MeResponse } from '@masq/shared';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { SpacesSidebar } from './SpacesSidebar';
import { CallDock } from './rtc/CallDock';
import { useRtc } from '../rtc/RtcProvider';

interface AuthenticatedShellProps {
  me: MeResponse;
  onLogout: () => Promise<void>;
  children: ReactNode;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';
const RELEASES_URL = 'https://github.com/azimoto99/masq/releases';

export function AuthenticatedShell({ me, onLogout, children }: AuthenticatedShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const rtc = useRtc();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeMaskId, setActiveMaskId] = useState<string>(
    () => window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY) ?? me.masks[0]?.id ?? '',
  );
  const activeMask = me.masks.find((mask) => mask.id === activeMaskId) ?? me.masks[0] ?? null;

  useEffect(() => {
    if (me.masks.length === 0) {
      setActiveMaskId('');
      window.localStorage.removeItem(ACTIVE_MASK_STORAGE_KEY);
      return;
    }

    const stillExists = me.masks.some((mask) => mask.id === activeMaskId);
    if (stillExists) {
      return;
    }

    const nextMaskId = me.masks[0].id;
    setActiveMaskId(nextMaskId);
    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, nextMaskId);
  }, [activeMaskId, me.masks]);

  const onChangeActiveMask = (nextMaskId: string) => {
    setActiveMaskId(nextMaskId);
    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, nextMaskId);
  };

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
      location.pathname.startsWith('/masks') ||
      location.pathname.startsWith('/home') ||
      location.pathname.startsWith('/perks'));

  const shellBottomPadding = rtc.sessionId ? 'calc(var(--masq-dock-height) + 1rem)' : '1rem';

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3" style={{ paddingBottom: shellBottomPadding }}>
      <header className="masq-surface masq-panel shrink-0 rounded-3xl px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1">
              <BrandLogo className="h-7 w-auto select-none" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Masq</p>
              <p className="text-xs text-slate-300">{me.user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="rounded-md border border-ink-700 bg-ink-900/80 px-2 py-1">
              <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Active Mask</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: activeMask?.color ?? '#78e6da' }}
                />
                <select
                  className="min-w-[116px] rounded-md border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-xs text-slate-200 focus:border-neon-400"
                  value={activeMask?.id ?? ''}
                  onChange={(event) => onChangeActiveMask(event.target.value)}
                  disabled={me.masks.length === 0}
                >
                  {me.masks.length === 0 ? <option value="">none</option> : null}
                  {me.masks.map((mask) => (
                    <option key={mask.id} value={mask.id}>
                      {mask.displayName}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300 hover:text-white"
            >
              Download Now
            </a>
            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              disabled={loggingOut}
              className="rounded-md border border-ink-700 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>
      {showGlobalSpacesSidebar ? (
        <>
          <details className="masq-panel-muted shrink-0 rounded-2xl p-3 lg:hidden">
            <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.16em] text-slate-300">
              Open Spaces
            </summary>
            <div className="mt-3">
              <SpacesSidebar activeMaskId={activeMask?.id ?? null} />
            </div>
          </details>
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px,1fr]">
            <SpacesSidebar
              activeMaskId={activeMask?.id ?? null}
              className="hidden min-h-0 lg:block lg:h-full"
            />
            <div className="min-h-0 overflow-hidden">{children}</div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      )}
      <CallDock />
    </div>
  );
}
