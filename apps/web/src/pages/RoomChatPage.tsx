import {
  ClientSocketEventSchema,
  DEFAULT_MUTE_MINUTES,
  MAX_ROOM_MESSAGE_LENGTH,
  RoomKindSchema,
  ServerSocketEventSchema,
  type MeResponse,
  type Room,
  type RoomKind,
  type RoomListItem,
  type RoomMemberState,
  type RoomMessage,
  type SocketAuraSummary,
} from '@masq/shared';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  buildUploadUrl,
  createRoom,
  exileRoomMember,
  joinRoom,
  listRooms,
  muteRoomMember,
  setRoomLocked,
  uploadImage,
} from '../lib/api';
import { createRealtimeSocket } from '../lib/realtime';
import { MaskAvatar } from '../components/MaskAvatar';
import { AuraBadge } from '../components/AuraBadge';
import { RTCPanel } from '../components/RTCPanel';
import { SpacesSidebar } from '../components/SpacesSidebar';

interface RoomChatPageProps {
  me: MeResponse;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';

const formatTimestamp = (isoDate: string) => {
  return new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMuteRemaining = (expiresAt: string, nowMs: number) => {
  const remainingMs = Date.parse(expiresAt) - nowMs;
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  return `${remainingMinutes}m`;
};

export function RoomChatPage({ me }: RoomChatPageProps) {
  const navigate = useNavigate();
  const params = useParams<{ roomId: string }>();
  const selectedRoomId = params.roomId ?? null;

  const [activeMaskId, setActiveMaskId] = useState<string | null>(
    window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY),
  );

  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [createTitle, setCreateTitle] = useState('Night Session');
  const [createKind, setCreateKind] = useState<RoomKind>('EPHEMERAL');
  const [createHours, setCreateHours] = useState(2);
  const [createLocked, setCreateLocked] = useState(false);
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMemberState[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [roomExpired, setRoomExpired] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>(
    'idle',
  );
  const [socketError, setSocketError] = useState<string | null>(null);
  const [moderationNotice, setModerationNotice] = useState<string | null>(null);
  const [selfMuteExpiresAt, setSelfMuteExpiresAt] = useState<string | null>(null);
  const [moderationPendingMaskId, setModerationPendingMaskId] = useState<string | null>(null);
  const [lockPending, setLockPending] = useState(false);
  const [composerBody, setComposerBody] = useState('');
  const [composerImageFile, setComposerImageFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [auraByMaskId, setAuraByMaskId] = useState<Record<string, SocketAuraSummary>>(() =>
    Object.fromEntries(
      me.masks
        .filter((mask) => mask.aura)
        .map((mask) => [mask.id, mask.aura as SocketAuraSummary]),
    ),
  );

  const socketRef = useRef<WebSocket | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const activeMask = useMemo(
    () => me.masks.find((mask) => mask.id === activeMaskId) ?? null,
    [activeMaskId, me.masks],
  );

  const selectedRoomMembership = useMemo(
    () => rooms.find((candidate) => candidate.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const currentMember = useMemo(
    () => members.find((member) => member.maskId === activeMaskId) ?? null,
    [activeMaskId, members],
  );

  const isHost =
    currentMember?.role === 'HOST' || (selectedRoomMembership?.role === 'HOST' && currentMember !== null);

  const isMuted = Boolean(selfMuteExpiresAt && Date.parse(selfMuteExpiresAt) > nowMs);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (me.masks.length === 0) {
      setActiveMaskId(null);
      window.localStorage.removeItem(ACTIVE_MASK_STORAGE_KEY);
      return;
    }

    const stillValid = me.masks.some((mask) => mask.id === activeMaskId);
    if (stillValid) {
      return;
    }

    const firstMask = me.masks[0].id;
    setActiveMaskId(firstMask);
    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, firstMask);
  }, [activeMaskId, me.masks]);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!isMuted) {
      setSelfMuteExpiresAt((current) => {
        if (!current) {
          return current;
        }

        return Date.parse(current) > nowMs ? current : null;
      });
    }
  }, [isMuted, nowMs]);

  const reloadRooms = async (maskId: string) => {
    setRoomsLoading(true);
    setRoomsError(null);

    try {
      const response = await listRooms(maskId);
      setRooms(response.rooms);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to load rooms';
      setRoomsError(message);
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeMaskId) {
      setRooms([]);
      return;
    }

    void reloadRooms(activeMaskId);
  }, [activeMaskId]);

  useEffect(() => {
    setMobileSidebarOpen(false);
    setMobileContextOpen(false);
  }, [selectedRoomId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.close();
      socketRef.current = null;
    }

    setRoom(null);
    setMembers([]);
    setMessages([]);
    setSocketError(null);
    setModerationNotice(null);
    setSelfMuteExpiresAt(null);
    setRoomExpired(false);

    if (!selectedRoomId || !activeMaskId) {
      setSocketStatus('idle');
      return;
    }

    let ws: WebSocket;
    try {
      ws = createRealtimeSocket();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Socket URL is invalid';
      setSocketStatus('disconnected');
      setSocketError(`Realtime connection failed: ${message}`);
      return;
    }

    socketRef.current = ws;
    setSocketStatus('connecting');

    ws.onopen = () => {
      setSocketStatus('connected');
      const joinEvent = ClientSocketEventSchema.parse({
        type: 'JOIN_ROOM',
        data: {
          roomId: selectedRoomId,
          maskId: activeMaskId,
        },
      });

      ws.send(JSON.stringify(joinEvent));
    };

    ws.onmessage = (event) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(event.data as string);
      } catch {
        setSocketError('Socket payload could not be parsed');
        return;
      }

      const parsedEvent = ServerSocketEventSchema.safeParse(parsedJson);
      if (!parsedEvent.success) {
        setSocketError('Unexpected socket event payload');
        return;
      }

      const socketEvent = parsedEvent.data;
      switch (socketEvent.type) {
        case 'ROOM_STATE': {
          setRoom(socketEvent.data.room);
          setMembers(socketEvent.data.members);
          setMessages(socketEvent.data.recentMessages);
          setAuraByMaskId((current) => {
            const next = { ...current };
            for (const member of socketEvent.data.members) {
              if (member.aura) {
                next[member.maskId] = member.aura;
              }
            }
            for (const message of socketEvent.data.recentMessages) {
              if (message.mask.aura) {
                next[message.mask.maskId] = message.mask.aura;
              }
            }
            return next;
          });
          setRoomExpired(false);
          setSocketError(null);
          break;
        }
        case 'NEW_MESSAGE': {
          if (socketEvent.data.message.mask.aura) {
            setAuraByMaskId((current) => ({
              ...current,
              [socketEvent.data.message.mask.maskId]: socketEvent.data.message.mask.aura as SocketAuraSummary,
            }));
          }
          setMessages((prev) => [...prev, socketEvent.data.message]);
          break;
        }
        case 'MEMBER_JOINED': {
          const payload = socketEvent.data;
          if (!('roomId' in payload)) {
            break;
          }
          const roomMember = payload.member;
          setMembers((prev) => {
            const exists = prev.some((member) => member.maskId === roomMember.maskId);
            if (exists) {
              return prev;
            }

            return [...prev, roomMember];
          });
          if (roomMember.aura) {
            setAuraByMaskId((current) => ({
              ...current,
              [roomMember.maskId]: roomMember.aura as SocketAuraSummary,
            }));
          }
          break;
        }
        case 'MEMBER_LEFT': {
          const payload = socketEvent.data;
          if (!('roomId' in payload)) {
            break;
          }
          const roomMember = payload.member;
          setMembers((prev) => prev.filter((member) => member.maskId !== roomMember.maskId));
          break;
        }
        case 'ROOM_EXPIRED': {
          setRoomExpired(true);
          break;
        }
        case 'MODERATION_EVENT': {
          const moderationEvent = socketEvent.data;
          if (moderationEvent.actionType === 'MUTE' && moderationEvent.targetMaskId === activeMaskId) {
            if (moderationEvent.expiresAt) {
              setSelfMuteExpiresAt(moderationEvent.expiresAt);
              setModerationNotice(`You were muted until ${formatTimestamp(moderationEvent.expiresAt)}`);
            } else {
              setModerationNotice('You were muted by a host');
            }
          }

          if (moderationEvent.actionType === 'EXILE' && moderationEvent.targetMaskId === activeMaskId) {
            setSocketError('You were exiled from this room');
          }

          if (moderationEvent.actionType === 'LOCK' && typeof moderationEvent.locked === 'boolean') {
            setRoom((current) => (current ? { ...current, locked: moderationEvent.locked ?? current.locked } : current));
            setModerationNotice(moderationEvent.locked ? 'Room was locked by host' : 'Room was unlocked by host');
          }

          break;
        }
        case 'ERROR': {
          setSocketError(socketEvent.data.message);
          break;
        }
        case 'AURA_UPDATED': {
          setAuraByMaskId((current) => ({
            ...current,
            [socketEvent.data.maskId]: socketEvent.data.aura,
          }));
          break;
        }
      }
    };

    ws.onclose = () => {
      setSocketStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, [activeMaskId, selectedRoomId]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setSocketError('Socket is not connected');
      return;
    }

    if (!selectedRoomId || !activeMaskId || roomExpired) {
      return;
    }

    if (isMuted) {
      setSocketError(`Muted for ${formatMuteRemaining(selfMuteExpiresAt ?? new Date().toISOString(), nowMs)}`);
      return;
    }

    if (!composerBody.trim() && !composerImageFile) {
      return;
    }

    setSendingMessage(true);
    setSocketError(null);
    try {
      let imageUploadId: string | undefined;
      if (composerImageFile) {
        const upload = await uploadImage(
          {
            contextType: 'EPHEMERAL_ROOM',
            contextId: selectedRoomId,
          },
          composerImageFile,
        );
        imageUploadId = upload.upload.id;
      }

      const messageEvent = ClientSocketEventSchema.parse({
        type: 'SEND_MESSAGE',
        data: {
          roomId: selectedRoomId,
          maskId: activeMaskId,
          body: composerBody,
          imageUploadId,
        },
      });

      socketRef.current.send(JSON.stringify(messageEvent));
      setComposerBody('');
      setComposerImageFile(null);
    } catch (err) {
      setSocketError(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const onCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeMaskId) {
      return;
    }

    setRoomsError(null);

    try {
      const expiresAt =
        createKind === 'EPHEMERAL'
          ? new Date(Date.now() + Math.max(1, createHours) * 60 * 60 * 1000).toISOString()
          : null;

      const created = await createRoom({
        maskId: activeMaskId,
        title: createTitle,
        kind: createKind,
        expiresAt,
        locked: createLocked,
      });

      await reloadRooms(activeMaskId);
      navigate(`/rooms/${created.room.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Room creation failed';
      setRoomsError(message);
    }
  };

  const onJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeMaskId) {
      return;
    }

    const normalizedRoomId = joinRoomIdInput.trim();
    if (!normalizedRoomId) {
      return;
    }

    setRoomsError(null);

    try {
      await joinRoom(normalizedRoomId, { maskId: activeMaskId });
      await reloadRooms(activeMaskId);
      navigate(`/rooms/${normalizedRoomId}`);
      setJoinRoomIdInput('');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not join room';
      setRoomsError(message);
    }
  };

  const onCopyRoomCode = async () => {
    if (!selectedRoomId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room?.id ?? selectedRoomId);
      setModerationNotice('Room code copied');
    } catch {
      setSocketError('Could not copy room code');
    }
  };

  const onSelectMask = (maskId: string) => {
    setActiveMaskId(maskId);
    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, maskId);
  };

  const onToggleLock = async () => {
    if (!selectedRoomId || !activeMaskId || !room || !isHost) {
      return;
    }

    setLockPending(true);
    setSocketError(null);

    try {
      const response = await setRoomLocked(selectedRoomId, {
        actorMaskId: activeMaskId,
        locked: !room.locked,
      });

      if (response.room) {
        setRoom(response.room);
      }

      setModerationNotice(!room.locked ? 'Room locked by host control' : 'Room unlocked by host control');

      if (activeMaskId) {
        await reloadRooms(activeMaskId);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update room lock';
      setSocketError(message);
    } finally {
      setLockPending(false);
    }
  };

  const onMuteMember = async (targetMaskId: string) => {
    if (!selectedRoomId || !activeMaskId || !isHost) {
      return;
    }

    setModerationPendingMaskId(targetMaskId);
    setSocketError(null);

    try {
      await muteRoomMember(selectedRoomId, {
        actorMaskId: activeMaskId,
        targetMaskId,
        minutes: DEFAULT_MUTE_MINUTES,
      });

      setModerationNotice(`Mask muted for ${DEFAULT_MUTE_MINUTES} minutes`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to mute member';
      setSocketError(message);
    } finally {
      setModerationPendingMaskId(null);
    }
  };

  const onExileMember = async (targetMaskId: string) => {
    if (!selectedRoomId || !activeMaskId || !isHost) {
      return;
    }

    setModerationPendingMaskId(targetMaskId);
    setSocketError(null);

    try {
      await exileRoomMember(selectedRoomId, {
        actorMaskId: activeMaskId,
        targetMaskId,
      });

      setModerationNotice('Mask exiled from room');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to exile member';
      setSocketError(message);
    } finally {
      setModerationPendingMaskId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2 xl:hidden">
        <button
          type="button"
          onClick={() => {
            setMobileSidebarOpen((current) => !current);
          }}
          className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300"
        >
          {mobileSidebarOpen ? 'Hide Spaces' : 'Show Spaces'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileContextOpen((current) => !current);
          }}
          className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300"
        >
          {mobileContextOpen ? 'Hide Context' : 'Show Context'}
        </button>
      </div>

      <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside
          className={`${mobileSidebarOpen ? 'block' : 'hidden'} order-2 xl:order-1 xl:block xl:h-full xl:min-h-0 xl:overflow-hidden`}
        >
          <div className="flex h-full flex-col gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300 xl:hidden"
            >
              Close Spaces
            </button>
            <SpacesSidebar className="flex-1 min-h-0" activeMaskId={activeMaskId} />
            <div className="masq-panel-muted rounded-xl p-2.5">
              <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                Active Mask
              </label>
              <select
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-white focus:border-neon-400"
                value={activeMaskId ?? ''}
                onChange={(event) => onSelectMask(event.target.value)}
              >
                {me.masks.map((mask) => (
                  <option key={mask.id} value={mask.id}>
                    {mask.displayName}
                  </option>
                ))}
              </select>
              {activeMask ? (
                <div className="mt-2 flex items-center gap-2">
                  <MaskAvatar
                    displayName={activeMask.displayName}
                    color={activeMask.color}
                    avatarUploadId={activeMask.avatarUploadId}
                    auraColor={auraByMaskId[activeMask.id]?.color ?? activeMask.aura?.color}
                    sizeClassName="h-6 w-6"
                    textClassName="text-[9px]"
                  />
                  <p className="truncate text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    {activeMask.avatarSeed}
                  </p>
                  <AuraBadge aura={auraByMaskId[activeMask.id] ?? activeMask.aura} />
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="order-1 masq-panel rounded-2xl p-3 xl:order-2 xl:h-full xl:min-h-0 xl:overflow-hidden">
          <div className="flex h-full flex-col gap-3">
            {!selectedRoomId ? (
              <div className="masq-panel-muted rounded-xl p-4 text-sm text-slate-500">
                Pick a room from the left, create one, or join with a room code.
              </div>
            ) : (
              <>
                <div className="masq-panel-muted rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-white">{room?.title ?? 'Room'}</h2>
                      <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                        {room?.kind ?? 'CONNECTING'} - {socketStatus} - {room?.locked ? 'LOCKED' : 'OPEN'}
                      </p>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      Room code hidden
                    </p>
                  </div>

                  {roomExpired ? (
                    <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
                      Room expired. Messaging has been disabled.
                    </div>
                  ) : null}

                  {isMuted && selfMuteExpiresAt ? (
                    <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
                      You are muted for {formatMuteRemaining(selfMuteExpiresAt, nowMs)}.
                    </div>
                  ) : null}

                  {moderationNotice ? (
                    <div className="mt-3 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-xs text-cyan-200">
                      {moderationNotice}
                    </div>
                  ) : null}

                  {socketError ? (
                    <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
                      {socketError}
                    </div>
                  ) : null}
                </div>

                <RTCPanel
                  title="Room RTC"
                  contextLabel={room?.title ? `Room - ${room.title}` : 'Room Voice'}
                  contextType="EPHEMERAL_ROOM"
                  contextId={selectedRoomId}
                  maskId={activeMaskId}
                  actorMaskId={activeMaskId}
                  canModerate={isHost}
                  canEndCall={isHost}
                  disabled={roomExpired || !activeMaskId}
                  disabledReason={roomExpired ? 'Room expired. Calls are disabled.' : undefined}
                />

                <div
                  ref={messageListRef}
                  className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900/78 p-3"
                >
                  <div className="space-y-3">
                    {messages.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : null}
                    {messages.map((message) => (
                      <article key={message.id} className="rounded-xl border border-ink-700 bg-ink-800/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            <MaskAvatar
                              displayName={message.mask.displayName}
                              color={message.mask.color}
                              avatarUploadId={message.mask.avatarUploadId}
                              auraColor={auraByMaskId[message.mask.maskId]?.color ?? message.mask.aura?.color}
                              sizeClassName="h-6 w-6"
                              textClassName="text-[9px]"
                            />
                            <span className="font-medium text-white">{message.mask.displayName}</span>
                            <AuraBadge aura={auraByMaskId[message.mask.maskId] ?? message.mask.aura} />
                            <span className="text-xs text-slate-500">{message.mask.avatarSeed}</span>
                          </div>
                          <span className="text-xs text-slate-500">{formatTimestamp(message.createdAt)}</span>
                        </div>
                        {message.body ? (
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">{message.body}</p>
                        ) : null}
                        {message.image ? (
                          <a
                            className="mt-2 block max-w-sm overflow-hidden rounded-lg border border-ink-700 bg-ink-900/70"
                            href={buildUploadUrl(message.image.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={buildUploadUrl(message.image.id)}
                              alt={message.image.fileName}
                              className="max-h-80 w-full object-contain"
                              loading="lazy"
                            />
                          </a>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>

                <form onSubmit={sendMessage} className="masq-panel-muted rounded-xl p-3">
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">Message</label>
                  <textarea
                    data-testid="room-composer-textarea"
                    className="h-24 w-full resize-none rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                    value={composerBody}
                    onChange={(event) => setComposerBody(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Speak as your mask"
                    maxLength={MAX_ROOM_MESSAGE_LENGTH}
                    disabled={roomExpired || socketStatus !== 'connected' || isMuted || sendingMessage}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="cursor-pointer rounded-md border border-ink-700 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 hover:border-neon-400 hover:text-neon-100">
                      Attach Image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={roomExpired || socketStatus !== 'connected' || isMuted || sendingMessage}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setComposerImageFile(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {composerImageFile ? (
                      <button
                        type="button"
                        onClick={() => setComposerImageFile(null)}
                        className="rounded-md border border-ink-700 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white"
                      >
                        Clear Image
                      </button>
                    ) : null}
                  </div>
                  {composerImageFile ? (
                    <p className="mt-1 text-xs text-slate-400">Attachment: {composerImageFile.name}</p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">
                        {composerBody.length}/{MAX_ROOM_MESSAGE_LENGTH}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
                        Ctrl+Enter to send
                      </p>
                    </div>
                    <button
                      data-testid="room-send-submit-button"
                      className="rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      type="submit"
                      disabled={
                        roomExpired ||
                        socketStatus !== 'connected' ||
                        isMuted ||
                        sendingMessage ||
                        (!composerBody.trim() && !composerImageFile)
                      }
                    >
                      {sendingMessage ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </main>

        <aside
          className={`${mobileContextOpen ? 'block' : 'hidden'} order-3 xl:order-3 xl:block masq-panel rounded-2xl p-3 xl:h-full xl:min-h-0 xl:overflow-hidden`}
        >
          <div className="flex h-full min-h-0 flex-col gap-3">
            <button
              type="button"
              onClick={() => setMobileContextOpen(false)}
              className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300 xl:hidden"
            >
              Close Context
            </button>

            <form onSubmit={onCreateRoom} className="masq-panel-muted shrink-0 space-y-2 rounded-xl p-2.5">
              <h2 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Create Room</h2>
              <input
                data-testid="room-create-title-input"
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                maxLength={80}
                required
              />

              <select
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                value={createKind}
                onChange={(event) => setCreateKind(RoomKindSchema.parse(event.target.value))}
              >
                <option value="EPHEMERAL">Ephemeral</option>
                <option value="RITUAL">Ritual</option>
                <option value="NARRATIVE">Narrative</option>
              </select>

              {createKind === 'EPHEMERAL' ? (
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Expires In (hours)
                  </label>
                  <input
                    className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                    type="number"
                    min={1}
                    max={168}
                    value={createHours}
                    onChange={(event) => setCreateHours(Number(event.target.value))}
                  />
                </div>
              ) : null}

              <label className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={createLocked}
                  onChange={(event) => setCreateLocked(event.target.checked)}
                  className="h-3 w-3"
                />
                Create as locked room
              </label>

              <button
                data-testid="room-create-submit-button"
                className="w-full rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={!activeMaskId}
              >
                Create Room
              </button>
            </form>

            <form onSubmit={onJoinRoom} className="masq-panel-muted shrink-0 space-y-2 rounded-xl p-2.5">
              <h2 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Join Room</h2>
              <input
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-xs text-white focus:border-neon-400"
                value={joinRoomIdInput}
                onChange={(event) => setJoinRoomIdInput(event.target.value)}
                placeholder="Room code"
                required
              />
              <button
                className="w-full rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={!activeMaskId}
              >
                Join By Code
              </button>
            </form>

            {roomsLoading ? (
              <p className="text-xs text-slate-500">Refreshing room list...</p>
            ) : null}
            {!roomsLoading && rooms.length === 0 ? (
              <p className="text-xs text-slate-500">No active rooms for this mask yet.</p>
            ) : null}
            {roomsError ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {roomsError}
              </div>
            ) : null}

            {!selectedRoomId ? (
              <div className="masq-panel-muted rounded-xl p-3 text-xs text-slate-500">
                Select a room to view members and moderation controls.
              </div>
            ) : (
              <>
                <div className="masq-panel-muted rounded-xl p-3">
                  <h3 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Room Controls</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Room code hidden for privacy. Copy to share with trusted members.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void onCopyRoomCode();
                      }}
                      className="rounded-md border border-ink-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 transition hover:border-slate-500 hover:text-white"
                    >
                      Copy Code
                    </button>
                    {isHost && room ? (
                      <button
                        type="button"
                        className="rounded-md border border-neon-400/40 bg-neon-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-neon-200 hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={onToggleLock}
                        disabled={lockPending}
                      >
                        {lockPending ? 'Saving...' : room.locked ? 'Unlock' : 'Lock'}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900/78 p-3">
                  <h3 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Members</h3>
                  <div className="mt-2 space-y-2">
                    {members.length === 0 ? <p className="text-xs text-slate-500">No members connected.</p> : null}
                    {members.map((member) => {
                      const isSelf = member.maskId === activeMaskId;
                      const isBusy = moderationPendingMaskId === member.maskId;
                      return (
                        <div key={member.maskId} className="rounded-lg border border-ink-700 bg-ink-800/80 p-2.5">
                          <div className="flex items-center gap-2">
                            <MaskAvatar
                              displayName={member.displayName}
                              color={member.color}
                              avatarUploadId={member.avatarUploadId}
                              auraColor={auraByMaskId[member.maskId]?.color ?? member.aura?.color}
                              sizeClassName="h-6 w-6"
                              textClassName="text-[9px]"
                            />
                            <p className="text-sm font-medium text-white">{member.displayName}</p>
                            <AuraBadge aura={auraByMaskId[member.maskId] ?? member.aura} />
                          </div>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            {member.role} - {member.avatarSeed}
                          </p>

                          {isHost && !isSelf ? (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-200 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => {
                                  void onMuteMember(member.maskId);
                                }}
                                disabled={isBusy}
                              >
                                Mute {DEFAULT_MUTE_MINUTES}m
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-rose-200 hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => {
                                  void onExileMember(member.maskId);
                                }}
                                disabled={isBusy}
                              >
                                Exile
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}


