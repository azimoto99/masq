import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { MAX_MASKS_PER_USER, type MeResponse } from '@masq/shared';
import { ApiError, createMask, deleteMask, setMaskAvatar } from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';
import { MaskAvatar } from '../components/MaskAvatar';

interface MasksPageProps {
  me: MeResponse;
  onRefresh: () => Promise<void>;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';

const randomHexColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
const randomSeedSuffix = () => Math.random().toString(36).slice(2, 7);

export function MasksPage({ me, onRefresh }: MasksPageProps) {
  const [activeMaskId, setActiveMaskId] = useState<string | null>(
    window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY),
  );

  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('#8ff5ff');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [avatarUploadingMaskId, setAvatarUploadingMaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeMask = useMemo(
    () => me.masks.find((mask) => mask.id === activeMaskId) ?? null,
    [activeMaskId, me.masks],
  );

  useEffect(() => {
    if (me.masks.length === 0) {
      setActiveMaskId(null);
      window.localStorage.removeItem(ACTIVE_MASK_STORAGE_KEY);
      return;
    }

    const stillExists = me.masks.some((mask) => mask.id === activeMaskId);
    if (stillExists) {
      return;
    }

    const next = me.masks[0].id;
    setActiveMaskId(next);
    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, next);
  }, [activeMaskId, me.masks]);

  const selectMask = (maskId: string) => {
    setActiveMaskId(maskId);
    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, maskId);
  };

  const handleCreateMask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        displayName,
        color: color.trim() || undefined,
        avatarSeed: avatarSeed.trim() || undefined,
      };

      await createMask(payload);
      setDisplayName('');
      setAvatarSeed('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create mask');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMask = async (maskId: string, displayName: string) => {
    const shouldDelete = window.confirm(`Delete mask "${displayName}"? This cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setError(null);
    try {
      await deleteMask(maskId);
      if (activeMaskId === maskId) {
        window.localStorage.removeItem(ACTIVE_MASK_STORAGE_KEY);
      }
      await onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete mask');
    }
  };

  const handleAvatarUpload = async (maskId: string, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setAvatarUploadingMaskId(maskId);
    setError(null);
    try {
      await setMaskAvatar(maskId, file);
      await onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to upload avatar');
    } finally {
      setAvatarUploadingMaskId(null);
    }
  };

  const randomizeDraftAppearance = () => {
    setColor(randomHexColor());
    if (!avatarSeed.trim()) {
      setAvatarSeed(`mask-${randomSeedSuffix()}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <header className="masq-panel flex flex-col gap-4 rounded-2xl p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <BrandLogo />
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Masq Identity</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Choose or Create Mask</h1>
          <p className="mt-2 text-sm text-slate-400">Signed in as {me.user.email}</p>
        </div>

        <div className="masq-panel-muted rounded-xl px-4 py-3 text-sm text-slate-300">
          <div>
            Active mask: <span className="text-white">{activeMask?.displayName ?? 'none'}</span>
          </div>
          <div>
            Masks: {me.masks.length}/{MAX_MASKS_PER_USER}
          </div>
          <p className="mt-2 text-xs text-slate-500">Use the top navigation bar to switch sections.</p>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
        <div className="masq-panel rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-[0.3em] text-slate-500">Your Masks</h2>
          <div className="mt-4 space-y-3">
            {me.masks.length === 0 ? (
              <p className="masq-panel-muted rounded-xl p-4 text-sm text-slate-400">
                No masks yet. Create one to participate in rooms and chat.
              </p>
            ) : null}

            {me.masks.map((mask) => {
              const selected = mask.id === activeMaskId;
              return (
                <article
                  key={mask.id}
                  className={`rounded-2xl border p-4 transition ${
                    selected
                      ? 'border-neon-400/50 bg-neon-400/10'
                      : 'border-ink-700 bg-ink-900 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <MaskAvatar
                        displayName={mask.displayName}
                        color={mask.color}
                        avatarUploadId={mask.avatarUploadId}
                        sizeClassName="h-10 w-10"
                        textClassName="text-xs"
                      />
                      <div>
                        <p className="text-lg font-medium text-white">{mask.displayName}</p>
                        <p className="text-xs text-slate-500">seed: {mask.avatarSeed}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectMask(mask.id)}
                        className="rounded-lg border border-ink-600 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300 transition hover:border-neon-400 hover:text-neon-400"
                      >
                        {selected ? 'Selected' : 'Select'}
                      </button>
                      <label className="cursor-pointer rounded-lg border border-ink-600 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300 transition hover:border-neon-400 hover:text-neon-400">
                        {avatarUploadingMaskId === mask.id ? 'Uploading...' : 'Avatar'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          disabled={avatarUploadingMaskId === mask.id}
                          onChange={(event) => {
                            void handleAvatarUpload(mask.id, event.target.files);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleDeleteMask(mask.id, mask.displayName)}
                        className="rounded-lg border border-rose-500/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="masq-panel rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-[0.3em] text-slate-500">Create Mask</h2>
          <p className="mt-2 text-sm text-slate-400">
            Every room and message is tied to a mask, not your global account.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleCreateMask}>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Display Name</label>
              <input
                className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-neon-400"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ghost"
                data-testid="mask-display-name-input"
                required
                maxLength={40}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">Color</label>
                <button
                  type="button"
                  onClick={randomizeDraftAppearance}
                  className="rounded-md border border-ink-700 bg-ink-900/75 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white"
                >
                  Randomize
                </button>
              </div>
              <input
                className="h-10 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Avatar Seed (optional)</label>
              <input
                className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-neon-400"
                value={avatarSeed}
                onChange={(event) => setAvatarSeed(event.target.value)}
                placeholder="shadow-guest"
                maxLength={80}
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              data-testid="mask-create-submit-button"
              className="w-full rounded-xl border border-neon-400/40 bg-neon-400/10 px-4 py-2 text-sm font-medium text-neon-400 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={submitting || me.masks.length >= MAX_MASKS_PER_USER}
            >
              {me.masks.length >= MAX_MASKS_PER_USER
                ? `Mask limit reached (${MAX_MASKS_PER_USER})`
                : submitting
                  ? 'Creating mask...'
                  : 'Create mask'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
