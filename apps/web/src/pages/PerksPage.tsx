import { useMemo, useState } from 'react';
import type { MeResponse, UpdateRtcSettingsRequest } from '@masq/shared';
import { ApiError, grantDevEntitlement, updateRtcSettings } from '../lib/api';

interface PerksPageProps {
  me: MeResponse;
  onRefresh: () => Promise<void>;
}

const ENABLE_DEV_GRANT = String(import.meta.env.VITE_ENABLE_DEV_ENTITLEMENTS ?? '').toLowerCase() === 'true';

const AURA_STYLE_CATALOG = [
  {
    key: 'AURA_STYLE_BASE',
    name: 'Base Glow',
    requirement: 'All users',
  },
  {
    key: 'AURA_STYLE_NEON',
    name: 'Neon Spectrum',
    requirement: 'Masq Pro',
  },
  {
    key: 'AURA_STYLE_GLASS',
    name: 'Glass Halo',
    requirement: 'Masq Pro',
  },
];

export function PerksPage({ me, onRefresh }: PerksPageProps) {
  const [pending, setPending] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rtcDraft, setRtcDraft] = useState<UpdateRtcSettingsRequest>({
    advancedNoiseSuppression: me.rtcSettings.advancedNoiseSuppression,
    pushToTalkMode: me.rtcSettings.pushToTalkMode,
    pushToTalkHotkey: me.rtcSettings.pushToTalkHotkey,
    multiPinEnabled: me.rtcSettings.multiPinEnabled,
    pictureInPictureEnabled: me.rtcSettings.pictureInPictureEnabled,
    defaultScreenshareFps: me.rtcSettings.defaultScreenshareFps,
    defaultScreenshareQuality: me.rtcSettings.defaultScreenshareQuality,
    cursorHighlight: me.rtcSettings.cursorHighlight,
    selectedAuraStyle: me.rtcSettings.selectedAuraStyle,
  });

  const activeEntitlements = useMemo(() => {
    const nowMs = Date.now();
    return me.entitlements.filter((entitlement) => {
      if (!entitlement.expiresAt) {
        return true;
      }

      return Date.parse(entitlement.expiresAt) > nowMs;
    });
  }, [me.entitlements]);

  const hasPro = me.currentPlan === 'PRO';
  const unlockedKeys = new Set(me.cosmeticUnlocks.map((unlock) => unlock.key));

  const onGrantPro = async () => {
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      await grantDevEntitlement({
        userId: me.user.id,
        kind: 'PRO',
      });
      await onRefresh();
      setNotice('Masq Pro entitlement granted (dev).');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to grant entitlement');
    } finally {
      setPending(false);
    }
  };

  const onSaveRtcSettings = async () => {
    setSavingSettings(true);
    setError(null);
    setNotice(null);

    try {
      await updateRtcSettings(rtcDraft);
      await onRefresh();
      setNotice('RTC settings updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save RTC settings');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="masq-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Masq Pro</h1>
        <p className="mt-1 text-sm text-slate-400">
          Privacy-forward RTC upgrades for control, quality, scale, and expression. Recording is never enabled.
        </p>
      </header>

      <section className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
        <div className="masq-panel rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs uppercase tracking-[0.18em] text-slate-500">Plan</h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${
                hasPro
                  ? 'border-cyan-400/45 bg-cyan-400/10 text-cyan-100'
                  : 'border-ink-700 bg-ink-800 text-slate-400'
              }`}
            >
              {me.currentPlan}
            </span>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <article className="rounded-lg border border-ink-700 bg-ink-900/75 p-2.5">
              <p className="text-sm font-medium text-white">FREE</p>
              <p className="mt-1 text-xs text-slate-500">Core text/voice, base aura styles, and standard participant cap.</p>
            </article>
            <article className="rounded-lg border border-cyan-400/35 bg-cyan-400/10 p-2.5">
              <p className="text-sm font-medium text-cyan-100">PRO</p>
              <p className="mt-1 text-xs text-cyan-100/85">
                Advanced RTC controls, layout tools, premium aura styles, owner server perks.
              </p>
            </article>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-cyan-100 opacity-80"
              title="Checkout integration is not enabled yet"
            >
              Upgrade (Coming Soon)
            </button>
            {ENABLE_DEV_GRANT ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void onGrantPro();
                }}
                className="rounded-md border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? 'Granting...' : 'Grant Pro (Dev)'}
              </button>
            ) : null}
          </div>

          <div className="mt-4">
            <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">Aura Styles</h3>
            <div className="mt-2 space-y-2">
              {AURA_STYLE_CATALOG.map((style) => {
                const unlocked =
                  style.key === 'AURA_STYLE_BASE' ||
                  unlockedKeys.has(style.key) ||
                  (hasPro && style.key !== 'AURA_STYLE_BASE');

                return (
                  <article key={style.key} className="rounded-lg border border-ink-700 bg-ink-900/75 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{style.name}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${
                          unlocked
                            ? 'border-cyan-400/45 bg-cyan-400/10 text-cyan-100'
                            : 'border-ink-700 bg-ink-800 text-slate-500'
                        }`}
                      >
                        {unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{style.requirement}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <div className="masq-panel rounded-xl p-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-slate-500">RTC Pro Controls</h2>
          {!hasPro ? (
            <p className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100">
              Locked on FREE. Upgrade to enable advanced noise suppression, multi-pin, PiP, and screenshare presets.
            </p>
          ) : null}

          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/70 px-2 py-1.5 text-xs text-slate-300">
              Advanced noise suppression
              <input
                type="checkbox"
                checked={Boolean(rtcDraft.advancedNoiseSuppression)}
                disabled={!hasPro}
                onChange={(event) =>
                  setRtcDraft((current) => ({ ...current, advancedNoiseSuppression: event.target.checked }))
                }
              />
            </label>

            <label className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/70 px-2 py-1.5 text-xs text-slate-300">
              Multi-pin layout
              <input
                type="checkbox"
                checked={Boolean(rtcDraft.multiPinEnabled)}
                disabled={!hasPro}
                onChange={(event) =>
                  setRtcDraft((current) => ({ ...current, multiPinEnabled: event.target.checked }))
                }
              />
            </label>

            <label className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/70 px-2 py-1.5 text-xs text-slate-300">
              Picture in picture
              <input
                type="checkbox"
                checked={Boolean(rtcDraft.pictureInPictureEnabled)}
                disabled={!hasPro}
                onChange={(event) =>
                  setRtcDraft((current) => ({ ...current, pictureInPictureEnabled: event.target.checked }))
                }
              />
            </label>

            <label className="block rounded-md border border-ink-700 bg-ink-900/70 px-2 py-1.5 text-xs text-slate-300">
              Push-to-talk hotkey
              <input
                className="mt-1 w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-white"
                value={rtcDraft.pushToTalkHotkey ?? 'V'}
                disabled={!hasPro}
                onChange={(event) =>
                  setRtcDraft((current) => ({ ...current, pushToTalkHotkey: event.target.value }))
                }
              />
            </label>

            <button
              type="button"
              disabled={savingSettings || !hasPro}
              onClick={() => {
                void onSaveRtcSettings();
              }}
              className="w-full rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSettings ? 'Saving...' : 'Save RTC Settings'}
            </button>
          </div>

          <div className="mt-4">
            <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">Active Entitlements</h3>
            <div className="mt-2 space-y-2">
              {activeEntitlements.length === 0 ? (
                <p className="text-sm text-slate-500">No active entitlements.</p>
              ) : (
                activeEntitlements.map((entitlement) => (
                  <article key={entitlement.id} className="rounded-lg border border-ink-700 bg-ink-900/75 p-2.5">
                    <p className="text-sm font-medium text-white">{entitlement.kind}</p>
                    <p className="text-[11px] uppercase tracking-[0.11em] text-slate-500">Source: {entitlement.source}</p>
                    <p className="text-xs text-slate-500">
                      {entitlement.expiresAt
                        ? `Expires ${new Date(entitlement.expiresAt).toLocaleString()}`
                        : 'No expiry'}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          {notice ? <p className="mt-2 text-xs text-cyan-200">{notice}</p> : null}
          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
