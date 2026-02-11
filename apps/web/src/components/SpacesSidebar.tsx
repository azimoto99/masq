import { type RoomListItem, type ServerListItem } from '@masq/shared';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, listRooms, listServers } from '../lib/api';

interface SpacesSidebarProps {
  className?: string;
  servers?: ServerListItem[];
  serversLoading?: boolean;
  serversError?: string | null;
  selectedServerId?: string | null;
  activeMaskId?: string | null;
  onOpenServerDialog?: () => void;
}

const toServerGlyph = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return '?';
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
};

const STATIC_SPACES: Array<{ key: 'friends' | 'dm' | 'rooms'; label: string; to: string; testId?: string }> = [
  { key: 'friends', label: 'Friends', to: '/friends' },
  { key: 'dm', label: 'DMs', to: '/dm' },
  { key: 'rooms', label: 'Rooms', to: '/rooms', testId: 'open-rooms-button' },
];

export function SpacesSidebar({
  className,
  servers,
  serversLoading,
  serversError,
  selectedServerId,
  activeMaskId,
  onOpenServerDialog,
}: SpacesSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [internalServers, setInternalServers] = useState<ServerListItem[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [roomItems, setRoomItems] = useState<RoomListItem[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const persistedMaskId = window.localStorage.getItem('masq.activeMaskId');
  const effectiveMaskId = activeMaskId ?? persistedMaskId;

  useEffect(() => {
    if (servers !== undefined) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setInternalLoading(true);
      setInternalError(null);
      try {
        const response = await listServers();
        if (!cancelled) {
          setInternalServers(response.servers);
        }
      } catch (err) {
        if (!cancelled) {
          setInternalError(err instanceof ApiError ? err.message : 'Failed to load servers');
        }
      } finally {
        if (!cancelled) {
          setInternalLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [servers]);

  useEffect(() => {
    if (!effectiveMaskId) {
      setRoomItems([]);
      setRoomsError(null);
      return;
    }

    let cancelled = false;
    const loadRooms = async () => {
      setRoomsLoading(true);
      setRoomsError(null);
      try {
        const response = await listRooms(effectiveMaskId);
        if (!cancelled) {
          setRoomItems(response.rooms);
        }
      } catch (err) {
        if (!cancelled) {
          setRoomsError(err instanceof ApiError ? err.message : 'Failed to load rooms');
          setRoomItems([]);
        }
      } finally {
        if (!cancelled) {
          setRoomsLoading(false);
        }
      }
    };

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [effectiveMaskId, location.pathname]);

  const effectiveServers = servers ?? internalServers;
  const effectiveLoading = serversLoading ?? internalLoading;
  const effectiveError = serversError ?? internalError;

  const activeServerId = useMemo(() => {
    if (selectedServerId) {
      return selectedServerId;
    }

    if (!location.pathname.startsWith('/servers/')) {
      return null;
    }

    const segment = location.pathname.split('/')[2] ?? null;
    return segment || null;
  }, [location.pathname, selectedServerId]);
  const activeRoomId = useMemo(() => {
    if (!location.pathname.startsWith('/rooms/')) {
      return null;
    }

    const segment = location.pathname.split('/')[2] ?? null;
    return segment || null;
  }, [location.pathname]);

  const isSpaceActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <div className={`masq-surface border border-ink-700 bg-ink-800/80 p-3 ${className ?? ''}`}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Spaces</p>
            <h1 className="text-base font-semibold text-white">Switch</h1>
          </div>
          {onOpenServerDialog ? (
            <button
              type="button"
              onClick={onOpenServerDialog}
              className="rounded-md border border-neon-400/40 bg-neon-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-neon-200 hover:border-neon-400"
            >
              Create / Join
            </button>
          ) : null}
        </div>

        <div className="space-y-1.5">
          {STATIC_SPACES.map((item) => (
            <button
              key={item.key}
              type="button"
              data-testid={item.testId}
              onClick={() => navigate(item.to)}
              className={`w-full rounded-md border px-2.5 py-2 text-left text-xs uppercase tracking-[0.12em] transition ${
                isSpaceActive(item.to)
                  ? 'masq-focus-ring border-neon-400/45 bg-neon-400/10 text-neon-100'
                  : 'border-ink-700 bg-ink-900/70 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Servers</p>

          {effectiveLoading ? <p className="mt-2 text-xs text-slate-500">Loading servers...</p> : null}
          {!effectiveLoading && effectiveServers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No servers yet.</p>
          ) : null}

          <div className="mt-2 space-y-1.5">
            {effectiveServers.map((item) => (
              <button
                key={item.server.id}
                type="button"
                onClick={() => navigate(`/servers/${item.server.id}`)}
                className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${
                  activeServerId === item.server.id
                    ? 'masq-focus-ring border-neon-400/45 bg-neon-400/10 text-white'
                    : 'border-ink-700 bg-ink-900/75 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink-700 bg-ink-800 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                    {toServerGlyph(item.server.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.server.name}</p>
                    <p className="truncate text-[10px] uppercase tracking-[0.11em] text-slate-500">
                      {item.role} - {item.serverMask.displayName}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {effectiveError ? (
            <p className="mt-2 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
              {effectiveError}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Rooms</p>

          {!effectiveMaskId ? (
            <p className="mt-2 text-xs text-slate-500">Select an active mask to load rooms.</p>
          ) : null}
          {effectiveMaskId && roomsLoading ? <p className="mt-2 text-xs text-slate-500">Loading rooms...</p> : null}
          {effectiveMaskId && !roomsLoading && roomItems.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No active rooms.</p>
          ) : null}

          <div className="mt-2 space-y-1.5">
            {roomItems.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => navigate(`/rooms/${room.id}`)}
                className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${
                  activeRoomId === room.id
                    ? 'masq-focus-ring border-neon-400/45 bg-neon-400/10 text-white'
                    : 'border-ink-700 bg-ink-900/75 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <p className="truncate text-xs font-medium">{room.title}</p>
                <p className="truncate text-[10px] uppercase tracking-[0.11em] text-slate-500">
                  {room.kind} - {room.role}
                </p>
              </button>
            ))}
          </div>

          {roomsError ? (
            <p className="mt-2 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
              {roomsError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
