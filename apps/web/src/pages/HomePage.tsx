import { Link } from 'react-router-dom';
import type { MeResponse } from '@masq/shared';
import { BrandLogo } from '../components/BrandLogo';

interface HomePageProps {
  me: MeResponse;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';

export function HomePage({ me }: HomePageProps) {
  const activeMaskId = window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY);
  const activeMask = me.masks.find((mask) => mask.id === activeMaskId) ?? me.masks[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-3xl border border-ink-700 bg-ink-800/85 p-6 shadow-2xl shadow-black/40">
        <BrandLogo />
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Masq Home</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Control Center</h1>
        <p className="mt-2 text-sm text-slate-400">
          Signed in as {me.user.email}. Identity in chat always comes from your selected mask.
        </p>
        <p className="mt-3 text-sm text-slate-300">
          Active mask: <span className="text-white">{activeMask?.displayName ?? 'none selected'}</span>
        </p>
      </header>

      {me.masks.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Create a mask before joining rooms, servers, or DMs.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/masks"
          data-testid="home-open-masks-button"
          className="rounded-2xl border border-neon-400/40 bg-neon-400/10 p-4 text-left transition hover:border-neon-400"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Identity</p>
          <p className="mt-2 text-lg font-medium text-white">Masks</p>
          <p className="mt-1 text-sm text-slate-400">Create and select up to three masks.</p>
        </Link>

        <Link
          to="/friends"
          className="rounded-2xl border border-ink-700 bg-ink-800/80 p-4 text-left transition hover:border-slate-500"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Social</p>
          <p className="mt-2 text-lg font-medium text-white">Friends</p>
          <p className="mt-1 text-sm text-slate-400">Send requests, accept, and start DMs.</p>
        </Link>

        <Link
          to="/dm"
          className="rounded-2xl border border-ink-700 bg-ink-800/80 p-4 text-left transition hover:border-slate-500"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Chat</p>
          <p className="mt-2 text-lg font-medium text-white">Direct Messages</p>
          <p className="mt-1 text-sm text-slate-400">Realtime 1:1 threads with mask switching.</p>
        </Link>

        <Link
          to="/servers"
          className="rounded-2xl border border-ink-700 bg-ink-800/80 p-4 text-left transition hover:border-slate-500"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Guilds</p>
          <p className="mt-2 text-lg font-medium text-white">Servers</p>
          <p className="mt-1 text-sm text-slate-400">Persistent channels, invites, and roles.</p>
        </Link>

        <Link
          to="/rooms"
          className="rounded-2xl border border-ink-700 bg-ink-800/80 p-4 text-left transition hover:border-slate-500"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sessions</p>
          <p className="mt-2 text-lg font-medium text-white">Ephemeral Rooms</p>
          <p className="mt-1 text-sm text-slate-400">Create short-lived rooms with realtime chat.</p>
        </Link>
      </section>
    </div>
  );
}
