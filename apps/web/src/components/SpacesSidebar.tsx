import { type DmThreadListItem, type RoomListItem, type ServerListItem } from '@masq/shared';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, listDmThreads, listRooms, listServers } from '../lib/api';

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

const STATIC_SPACES: Array<{
  key: 'home' | 'masks' | 'friends' | 'dm' | 'rooms' | 'narrative' | 'perks';
  label: string;
  to: string;
  testId?: string;
}> = [
  { key: 'home', label: 'Home', to: '/home' },
  { key: 'masks', label: 'Masks', to: '/masks' },
  { key: 'friends', label: 'Friends', to: '/friends' },
  { key: 'dm', label: 'DMs', to: '/dm' },
  { key: 'rooms', label: 'Rooms', to: '/rooms', testId: 'open-rooms-button' },
  { key: 'narrative', label: 'Narrative', to: '/narrative' },
  { key: 'perks', label: 'Perks', to: '/perks' },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [internalServers, setInternalServers] = useState<ServerListItem[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [roomItems, setRoomItems] = useState<RoomListItem[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [dmItems, setDmItems] = useState<DmThreadListItem[]>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const persistedMaskId = window.localStorage.getItem('masq.activeMaskId');
  const effectiveMaskId = activeMaskId ?? persistedMaskId;
  const normalizedSearch = searchQuery.trim().toLowerCase();

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
  }, [reloadNonce, servers]);

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
  }, [effectiveMaskId, location.pathname, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    const loadDmItems = async () => {
      setDmLoading(true);
      setDmError(null);
      try {
        const response = await listDmThreads();
        if (!cancelled) {
          setDmItems(response.threads);
        }
      } catch (err) {
        if (!cancelled) {
          setDmError(err instanceof ApiError ? err.message : 'Failed to load DM threads');
          setDmItems([]);
        }
      } finally {
        if (!cancelled) {
          setDmLoading(false);
        }
      }
    };

    void loadDmItems();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, reloadNonce]);

  const effectiveServers = servers ?? internalServers;
  const effectiveLoading = serversLoading ?? internalLoading;
  const effectiveError = serversError ?? internalError;
  const filteredServers = useMemo(() => {
    if (!normalizedSearch) {
      return effectiveServers;
    }

    return effectiveServers.filter((item) => {
      const name = item.server.name.toLowerCase();
      const mask = item.serverMask.displayName.toLowerCase();
      const role = item.role.toLowerCase();
      return name.includes(normalizedSearch) || mask.includes(normalizedSearch) || role.includes(normalizedSearch);
    });
  }, [effectiveServers, normalizedSearch]);
  const filteredRooms = useMemo(() => {
    if (!normalizedSearch) {
      return roomItems;
    }

    return roomItems.filter((room) => {
      const title = room.title.toLowerCase();
      const kind = room.kind.toLowerCase();
      const role = room.role.toLowerCase();
      return title.includes(normalizedSearch) || kind.includes(normalizedSearch) || role.includes(normalizedSearch);
    });
  }, [normalizedSearch, roomItems]);
  const filteredDmItems = useMemo(() => {
    if (!normalizedSearch) {
      return dmItems;
    }

    return dmItems.filter((item) => {
      const displayName = item.peer.defaultMask?.displayName.toLowerCase() ?? '';
      const preview = item.lastMessage?.body.toLowerCase() ?? '';
      return displayName.includes(normalizedSearch) || preview.includes(normalizedSearch);
    });
  }, [dmItems, normalizedSearch]);

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
  const activeDmThreadId = useMemo(() => {
    if (!location.pathname.startsWith('/dm/')) {
      return null;
    }

    const segment = location.pathname.split('/')[2] ?? null;
    return segment || null;
  }, [location.pathname]);

  const isSpaceActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const onOpenServerAccess = () => {
    if (onOpenServerDialog) {
      onOpenServerDialog();
      return;
    }

    navigate('/servers?serverDialog=create');
  };
  const onRefreshLists = () => {
    setReloadNonce((current) => current + 1);
  };

  return (
    <div
      className={`masq-surface masq-panel min-h-0 overflow-y-auto p-2.5 ${className ?? ''}`}
    >
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">HUD</p>
            <h1 className="text-sm font-semibold text-white">Spaces</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRefreshLists}
              className="rounded-md border border-ink-700 bg-ink-900/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-600 hover:text-white"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onOpenServerAccess}
              className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300"
            >
              Create / Join
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">Search Spaces</span>
          <input
            className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-neon-400"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Server, room, DM..."
          />
        </label>

        <div className="space-y-1">
          {STATIC_SPACES.map((item) => (
            <button
              key={item.key}
              type="button"
              data-testid={item.testId}
              onClick={() => navigate(item.to)}
              className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] uppercase tracking-[0.12em] transition ${
                isSpaceActive(item.to)
                  ? 'border-cyan-400/45 bg-cyan-400/10 text-cyan-100'
                  : 'border-ink-700 bg-ink-900/70 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-ink-700 bg-ink-900/70 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Servers ({filteredServers.length}/{effectiveServers.length})
          </p>

          {effectiveLoading ? <p className="mt-2 text-xs text-slate-500">Loading servers...</p> : null}
          {!effectiveLoading && filteredServers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              {effectiveServers.length === 0 ? 'No servers yet.' : 'No servers match the current filter.'}
            </p>
          ) : null}

          <div className="mt-2 space-y-1">
            {filteredServers.map((item) => (
              <button
                key={item.server.id}
                type="button"
                onClick={() => navigate(`/servers/${item.server.id}`)}
                className={`w-full rounded-md border px-2 py-1.5 text-left transition ${
                  activeServerId === item.server.id
                    ? 'border-cyan-400/45 bg-cyan-400/10 text-white'
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

        <div className="rounded-lg border border-ink-700 bg-ink-900/70 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Rooms ({filteredRooms.length}/{roomItems.length})
          </p>

          {!effectiveMaskId ? (
            <p className="mt-2 text-xs text-slate-500">Select an active mask to load rooms.</p>
          ) : null}
          {effectiveMaskId && roomsLoading ? <p className="mt-2 text-xs text-slate-500">Loading rooms...</p> : null}
          {effectiveMaskId && !roomsLoading && filteredRooms.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              {roomItems.length === 0 ? 'No active rooms.' : 'No rooms match the current filter.'}
            </p>
          ) : null}

          <div className="mt-2 space-y-1">
            {filteredRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => navigate(`/rooms/${room.id}`)}
                className={`w-full rounded-md border px-2 py-1.5 text-left transition ${
                  activeRoomId === room.id
                    ? 'border-cyan-400/45 bg-cyan-400/10 text-white'
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

        <div className="rounded-lg border border-ink-700 bg-ink-900/70 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            DM Threads ({filteredDmItems.length}/{dmItems.length})
          </p>

          {dmLoading ? <p className="mt-2 text-xs text-slate-500">Loading DMs...</p> : null}
          {!dmLoading && filteredDmItems.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              {dmItems.length === 0 ? 'No DM threads yet.' : 'No DM threads match the current filter.'}
            </p>
          ) : null}

          <div className="mt-2 space-y-1">
            {filteredDmItems.map((item) => (
              <button
                key={item.thread.id}
                type="button"
                onClick={() => navigate(`/dm/${item.thread.id}`)}
                className={`w-full rounded-md border px-2 py-1.5 text-left transition ${
                  activeDmThreadId === item.thread.id
                    ? 'border-cyan-400/45 bg-cyan-400/10 text-white'
                    : 'border-ink-700 bg-ink-900/75 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <p className="truncate text-xs font-medium">{item.peer.defaultMask?.displayName ?? 'Masked Contact'}</p>
                <p className="truncate text-[10px] uppercase tracking-[0.11em] text-slate-500">
                  {item.lastMessage
                    ? item.lastMessage.body || (item.lastMessage.image ? '[image]' : 'No text')
                    : 'No messages'}
                </p>
              </button>
            ))}
          </div>

          {dmError ? (
            <p className="mt-2 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
              {dmError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
