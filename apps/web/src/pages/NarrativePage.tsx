import {
  ClientSocketEventSchema,
  MAX_ROOM_MESSAGE_LENGTH,
  ServerSocketEventSchema,
  type MeResponse,
  type NarrativeMessage,
  type NarrativeRoleAssignment,
  type NarrativeRoomState,
  type NarrativeSessionSummary,
  type NarrativeTemplate,
  type SocketAuraSummary,
} from '@masq/shared';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  advanceNarrativeRoom,
  createNarrativeRoom,
  getNarrativeRoom,
  joinNarrativeRoom,
  leaveNarrativeRoom,
  listNarrativeTemplates,
  sendNarrativeMessage,
  setNarrativeReady,
  startNarrativeRoom,
} from '../lib/api';
import { AuraBadge } from '../components/AuraBadge';
import { MaskAvatar } from '../components/MaskAvatar';
import { SpacesSidebar } from '../components/SpacesSidebar';
import { createRealtimeSocket } from '../lib/realtime';

interface NarrativePageProps {
  me: MeResponse;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';

const formatClock = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDuration = (durationSec: number) => {
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

const toCountdownLabel = (phaseEndsAt: string | null, nowMs: number) => {
  if (!phaseEndsAt) {
    return 'No timer';
  }
  const remainingMs = Date.parse(phaseEndsAt) - nowMs;
  if (remainingMs <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const toSocketAura = (aura: MeResponse['masks'][number]['aura'] | undefined): SocketAuraSummary | null => {
  if (!aura) {
    return null;
  }

  return {
    score: aura.score,
    effectiveScore: aura.effectiveScore,
    tier: aura.tier,
    color: aura.color,
    nextTierAt: aura.nextTierAt,
    lastActivityAt: aura.lastActivityAt,
  };
};

export function NarrativePage({ me }: NarrativePageProps) {
  const navigate = useNavigate();
  const params = useParams<{ roomId: string }>();
  const selectedRoomId = params.roomId ?? null;
  const socketRef = useRef<WebSocket | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const [activeMaskId, setActiveMaskId] = useState<string>(
    () => window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY) ?? me.masks[0]?.id ?? '',
  );
  const [templates, setTemplates] = useState<NarrativeTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [createTemplateId, setCreateTemplateId] = useState<string>('');
  const [joinCode, setJoinCode] = useState('');
  const [pending, setPending] = useState(false);
  const [roomState, setRoomState] = useState<NarrativeRoomState | null>(null);
  const [myRole, setMyRole] = useState<NarrativeRoleAssignment | null>(null);
  const [revealedRoles, setRevealedRoles] = useState<NarrativeRoleAssignment[]>([]);
  const [sessionSummary, setSessionSummary] = useState<NarrativeSessionSummary | null>(null);
  const [messages, setMessages] = useState<NarrativeMessage[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [auraByMaskId, setAuraByMaskId] = useState<Record<string, SocketAuraSummary>>(() =>
    Object.fromEntries(
      me.masks
        .map((mask) => [mask.id, toSocketAura(mask.aura)] as const)
        .filter((entry): entry is [string, SocketAuraSummary] => Boolean(entry[1])),
    ),
  );

  const activeMask = useMemo(() => me.masks.find((mask) => mask.id === activeMaskId) ?? null, [activeMaskId, me.masks]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === createTemplateId) ?? null,
    [createTemplateId, templates],
  );

  const isHost = roomState?.room.hostMaskId === activeMaskId;
  const activePhase = roomState?.state ? roomState.template.phases[roomState.state.phaseIndex] ?? null : null;
  const minPlayersMet = Boolean(roomState && roomState.members.length >= roomState.template.minPlayers);
  const readyCount = roomState?.members.filter((member) => member.membership.isReady).length ?? 0;
  const myMembership = roomState?.members.find((member) => member.membership.maskId === activeMaskId) ?? null;
  const roleDefinition =
    roomState && myRole ? roomState.template.roles.find((role) => role.key === myRole.roleKey) ?? null : null;
  const countdownLabel = toCountdownLabel(roomState?.state?.phaseEndsAt ?? null, nowMs);
  const canSendMessages = Boolean(roomState && roomState.room.status !== 'ENDED') && (activePhase?.allowTextChat ?? true);

  const roleLabelByMaskId = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const member of roomState?.members ?? []) {
      labels[member.mask.maskId] = member.mask.displayName;
    }
    return labels;
  }, [roomState?.members]);

  const loadRoom = useCallback(async (roomId: string) => {
    const response = await getNarrativeRoom(roomId);
    setRoomState({
      room: response.room,
      template: response.template,
      members: response.members,
      state: response.state,
    });
    setMyRole(response.myRole);
    setRevealedRoles(response.revealedRoles ?? []);
    setSessionSummary(response.sessionSummary);
    setMessages(response.recentMessages);
    setAuraByMaskId((current) => {
      const next = { ...current };
      for (const member of response.members) {
        if (member.mask.aura) {
          next[member.mask.maskId] = member.mask.aura;
        }
      }
      for (const message of response.recentMessages) {
        if (message.mask.aura) {
          next[message.mask.maskId] = message.mask.aura;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (me.masks.length === 0) {
      setActiveMaskId('');
      window.localStorage.removeItem(ACTIVE_MASK_STORAGE_KEY);
      return;
    }

    if (me.masks.some((mask) => mask.id === activeMaskId)) {
      return;
    }

    const nextMaskId = me.masks[0].id;
    setActiveMaskId(nextMaskId);
    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, nextMaskId);
  }, [activeMaskId, me.masks]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const response = await listNarrativeTemplates();
        if (!cancelled) {
          setTemplates(response.templates);
          setCreateTemplateId(response.templates[0]?.id ?? '');
        }
      } catch (err) {
        if (!cancelled) {
          setTemplatesError(err instanceof ApiError ? err.message : 'Failed to load narrative templates');
        }
      } finally {
        if (!cancelled) {
          setTemplatesLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setMobileSidebarOpen(false);
    setMobileContextOpen(false);
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) {
      setRoomState(null);
      setMyRole(null);
      setRevealedRoles([]);
      setSessionSummary(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    void loadRoom(selectedRoomId).catch((err) => {
      if (!cancelled) {
        setError(err instanceof ApiError ? err.message : 'Failed to load narrative room');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadRoom, selectedRoomId]);

  useEffect(() => {
    socketRef.current?.close();
    socketRef.current = null;

    if (!selectedRoomId || !activeMaskId) {
      setSocketStatus('idle');
      return;
    }

    let ws: WebSocket;
    try {
      ws = createRealtimeSocket();
    } catch (err) {
      setSocketStatus('disconnected');
      setError(err instanceof Error ? err.message : 'Realtime unavailable');
      return;
    }

    socketRef.current = ws;
    setSocketStatus('connecting');

    ws.onopen = () => {
      setSocketStatus('connected');
      const joinEvent = ClientSocketEventSchema.parse({
        type: 'JOIN_NARRATIVE_ROOM',
        data: {
          roomId: selectedRoomId,
          maskId: activeMaskId,
        },
      });
      ws.send(JSON.stringify(joinEvent));
    };

    ws.onmessage = (event) => {
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(event.data as string);
      } catch {
        setError('Unexpected realtime payload');
        return;
      }

      const parsed = ServerSocketEventSchema.safeParse(parsedPayload);
      if (!parsed.success) {
        setError('Unexpected realtime payload');
        return;
      }

      const socketEvent = parsed.data;
      if (socketEvent.type === 'NARRATIVE_ROOM_STATE') {
        if (socketEvent.data.room.id !== selectedRoomId) {
          return;
        }
        setRoomState(socketEvent.data);
        setAuraByMaskId((current) => {
          const next = { ...current };
          for (const member of socketEvent.data.members) {
            if (member.mask.aura) {
              next[member.mask.maskId] = member.mask.aura;
            }
          }
          return next;
        });
        return;
      }

      if (socketEvent.type === 'NARRATIVE_PHASE_CHANGED') {
        if (socketEvent.data.roomId !== selectedRoomId) {
          return;
        }
        setRoomState((current) =>
          current
            ? {
                ...current,
                state: current.state
                  ? {
                      ...current.state,
                      phaseIndex: socketEvent.data.phaseIndex,
                      phaseEndsAt: socketEvent.data.phaseEndsAt,
                      updatedAt: new Date().toISOString(),
                    }
                  : current.state,
              }
            : current,
        );
        return;
      }

      if (socketEvent.type === 'NARRATIVE_MEMBER_JOINED' || socketEvent.type === 'NARRATIVE_MEMBER_LEFT') {
        if (socketEvent.data.roomId !== selectedRoomId) {
          return;
        }
        void loadRoom(selectedRoomId).catch(() => {});
        return;
      }

      if (socketEvent.type === 'NARRATIVE_ROLE_ASSIGNED') {
        if (socketEvent.data.roomId !== selectedRoomId) {
          return;
        }
        setMyRole({
          id: `local-${socketEvent.data.roomId}-${socketEvent.data.roleKey}`,
          roomId: socketEvent.data.roomId,
          maskId: activeMaskId,
          roleKey: socketEvent.data.roleKey,
          secretPayload: socketEvent.data.secretPayload ?? null,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if (socketEvent.type === 'NARRATIVE_NEW_MESSAGE') {
        if (socketEvent.data.roomId !== selectedRoomId) {
          return;
        }
        if (socketEvent.data.message.mask.aura) {
          setAuraByMaskId((current) => ({
            ...current,
            [socketEvent.data.message.mask.maskId]: socketEvent.data.message.mask.aura as SocketAuraSummary,
          }));
        }
        setMessages((current) =>
          current.some((message) => message.id === socketEvent.data.message.id)
            ? current
            : [...current, socketEvent.data.message],
        );
        return;
      }

      if (socketEvent.type === 'NARRATIVE_SESSION_ENDED') {
        if (socketEvent.data.roomId !== selectedRoomId) {
          return;
        }
        setNotice('Session ended. Roles are now revealed.');
        void loadRoom(selectedRoomId).catch(() => {});
        return;
      }

      if (socketEvent.type === 'AURA_UPDATED') {
        setAuraByMaskId((current) => ({
          ...current,
          [socketEvent.data.maskId]: socketEvent.data.aura,
        }));
        return;
      }

      if (socketEvent.type === 'ERROR') {
        setError(socketEvent.data.message);
      }
    };

    ws.onclose = () => setSocketStatus('disconnected');
    return () => ws.close();
  }, [activeMaskId, loadRoom, selectedRoomId]);

  const onSelectMask = (maskId: string) => {
    setActiveMaskId(maskId);
    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, maskId);
  };

  const onCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeMaskId || !createTemplateId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await createNarrativeRoom({
        templateId: createTemplateId,
        hostMaskId: activeMaskId,
      });
      navigate(`/narrative/${created.room.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create narrative room');
    } finally {
      setPending(false);
    }
  };

  const onJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeMaskId || !joinCode.trim()) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const joined = await joinNarrativeRoom({
        code: joinCode.trim().toUpperCase(),
        maskId: activeMaskId,
      });
      navigate(`/narrative/${joined.roomId}`);
      setJoinCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to join narrative room');
    } finally {
      setPending(false);
    }
  };

  const onToggleReady = async () => {
    if (!roomState || !activeMaskId || !myMembership || roomState.room.status !== 'LOBBY') {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await setNarrativeReady(roomState.room.id, {
        maskId: activeMaskId,
        ready: !myMembership.membership.isReady,
      });
      await loadRoom(roomState.room.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update readiness');
    } finally {
      setPending(false);
    }
  };

  const onStart = async () => {
    if (!roomState || !activeMaskId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await startNarrativeRoom(roomState.room.id, activeMaskId);
      setRoomState((current) =>
        current
          ? {
              ...current,
              room: response.room,
              state: response.state,
            }
          : current,
      );
      setSessionSummary(response.sessionSummary ?? null);
      setRevealedRoles(response.revealedRoles ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to start session');
    } finally {
      setPending(false);
    }
  };

  const onAdvance = async () => {
    if (!roomState || !activeMaskId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await advanceNarrativeRoom(roomState.room.id, activeMaskId);
      setRoomState((current) =>
        current
          ? {
              ...current,
              room: response.room,
              state: response.state,
            }
          : current,
      );
      setSessionSummary(response.sessionSummary ?? null);
      setRevealedRoles(response.revealedRoles ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to advance phase');
    } finally {
      setPending(false);
    }
  };

  const onPlayAgain = async () => {
    if (!roomState || !activeMaskId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await createNarrativeRoom({
        templateId: roomState.template.id,
        hostMaskId: activeMaskId,
      });
      navigate(`/narrative/${created.room.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create next session');
    } finally {
      setPending(false);
    }
  };

  const onLeave = async () => {
    if (!roomState || !activeMaskId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await leaveNarrativeRoom(roomState.room.id, { maskId: activeMaskId });
      navigate('/narrative');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to leave narrative room');
    } finally {
      setPending(false);
    }
  };

  const onSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roomState || !activeMaskId || !messageBody.trim()) {
      return;
    }
    if (!canSendMessages) {
      setError('Text chat is disabled during this phase.');
      return;
    }
    setSendingMessage(true);
    setError(null);
    try {
      const sent = await sendNarrativeMessage(roomState.room.id, {
        maskId: activeMaskId,
        body: messageBody.trim(),
      });
      setMessages((current) =>
        current.some((message) => message.id === sent.message.id) ? current : [...current, sent.message],
      );
      setMessageBody('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to send narrative message');
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2 xl:hidden">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen((current) => !current)}
          className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300"
        >
          {mobileSidebarOpen ? 'Hide Spaces' : 'Show Spaces'}
        </button>
        <button
          type="button"
          onClick={() => setMobileContextOpen((current) => !current)}
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
              <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">Active Mask</label>
              <select
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-white focus:border-neon-400"
                value={activeMaskId}
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
                    sizeClassName="h-7 w-7"
                    textClassName="text-[9px]"
                  />
                  <div>
                    <p className="text-xs text-white">{activeMask.displayName}</p>
                    <div className="flex items-center gap-2">
                      <AuraBadge aura={auraByMaskId[activeMask.id] ?? activeMask.aura} showLabel />
                      <span className="text-[10px] text-slate-500">
                        {auraByMaskId[activeMask.id]?.effectiveScore ?? activeMask.aura?.effectiveScore ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="order-1 masq-panel rounded-2xl p-3 xl:order-2 xl:h-full xl:min-h-0 xl:overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-3">
            {!selectedRoomId ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="masq-panel-muted rounded-xl p-3">
                  <h2 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Narrative Templates</h2>
                  {templatesLoading ? <p className="mt-2 text-xs text-slate-500">Loading templates...</p> : null}
                  {templatesError ? (
                    <p className="mt-2 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                      {templatesError}
                    </p>
                  ) : null}
                  <div className="mt-2 space-y-2">
                    {templates.map((template) => (
                      <article key={template.id} className="rounded-lg border border-ink-700 bg-ink-900/70 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium text-white">{template.name}</h3>
                          {template.requiresEntitlement ? (
                            <span className="rounded border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-amber-200">
                              Pro
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{template.description}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          {template.minPlayers}-{template.maxPlayers} players | {template.phases.length} phases
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="masq-panel-muted rounded-xl p-3 text-sm text-slate-400">
                  Pick a template from the right panel to create a room, or join with an invite code.
                  <p className="mt-2 text-xs text-slate-500">
                    Sessions are phase-driven and role-based. Aura updates are subtle and cosmetic only.
                  </p>
                </div>
              </div>
            ) : roomState ? (
              <>
                <div className="masq-panel-muted rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-white">{roomState.template.name}</h2>
                      <p className="text-xs uppercase tracking-[0.13em] text-slate-500">
                        {roomState.room.status} | code {roomState.room.code} | {socketStatus}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {roomState.room.status === 'LOBBY' ? (
                        <>
                          <button
                            type="button"
                            onClick={onToggleReady}
                            disabled={pending || !myMembership}
                            className="rounded-md border border-ink-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {myMembership?.membership.isReady ? 'Unready' : 'Ready'}
                          </button>
                          {isHost ? (
                            <button
                              type="button"
                              onClick={onStart}
                              disabled={pending || !minPlayersMet}
                              className="rounded-md border border-neon-400/40 bg-neon-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-neon-200 hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pending ? 'Starting...' : 'Start'}
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={onLeave}
                        disabled={pending}
                        className="rounded-md border border-ink-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {roomState.members.length}/{roomState.template.maxPlayers} players joined | ready {readyCount}
                  </p>
                  {roomState.room.status === 'LOBBY' && !minPlayersMet ? (
                    <p className="mt-1 text-xs text-amber-200">
                      Need at least {roomState.template.minPlayers} players to start.
                    </p>
                  ) : null}
                  {error ? (
                    <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
                      {error}
                    </div>
                  ) : null}
                  {notice ? (
                    <div className="mt-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-xs text-cyan-200">
                      {notice}
                    </div>
                  ) : null}
                </div>

                {roomState.room.status === 'RUNNING' && activePhase ? (
                  <div className="rounded-xl border border-cyan-400/35 bg-cyan-400/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-200">Current Phase</p>
                        <h3 className="text-base font-semibold text-white">{activePhase.label}</h3>
                      </div>
                      <p className="font-mono text-sm text-cyan-100">{countdownLabel}</p>
                    </div>
                    <p className="mt-1 text-xs text-cyan-100/85">
                      Text chat {activePhase.allowTextChat ? 'enabled' : 'paused'} | Voice join{' '}
                      {activePhase.allowVoiceJoin ? 'enabled' : 'disabled'} | Screenshare{' '}
                      {activePhase.allowScreenshare ? 'enabled' : 'disabled'}
                    </p>
                    {isHost ? (
                      <button
                        type="button"
                        onClick={onAdvance}
                        disabled={pending}
                        className="mt-2 rounded-md border border-cyan-300/45 bg-cyan-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pending ? 'Advancing...' : 'Advance Phase'}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-xl border border-ink-700 bg-ink-900/75 p-3">
                  <h3 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Your Role</h3>
                  {roleDefinition ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-white">{roleDefinition.name}</p>
                      <p className="mt-1 text-xs text-slate-300">{roleDefinition.description}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">Role assignment pending.</p>
                  )}
                </div>

                {roomState.room.status === 'RUNNING' ? (
                  <div className="rounded-xl border border-ink-700 bg-ink-900/75 p-3">
                    <h3 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Voice Controls</h3>
                    {activePhase?.allowVoiceJoin ? (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-300">
                          Voice join is enabled for this phase. Narrative RTC controls are queued.
                        </p>
                        <button
                          type="button"
                          className="rounded-md border border-ink-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-400"
                          disabled
                        >
                          Join Voice Soon
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">Voice join is disabled for this phase.</p>
                    )}
                  </div>
                ) : null}

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
                          </div>
                          <span className="text-xs text-slate-500">{formatClock(message.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">{message.body}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <form onSubmit={onSendMessage} className="masq-panel-muted rounded-xl p-3">
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">Message</label>
                  <textarea
                    className="h-24 w-full resize-none rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                    value={messageBody}
                    onChange={(event) => setMessageBody(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={canSendMessages ? 'Share clues without revealing your mask' : 'Chat is disabled in this phase'}
                    maxLength={MAX_ROOM_MESSAGE_LENGTH}
                    disabled={sendingMessage || !canSendMessages}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {messageBody.length}/{MAX_ROOM_MESSAGE_LENGTH}
                    </p>
                    <button
                      className="rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      type="submit"
                      disabled={sendingMessage || !canSendMessages || !messageBody.trim()}
                    >
                      {sendingMessage ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-sm text-rose-200">
                Unable to load this narrative room.
              </div>
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
              <h2 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Create Narrative</h2>
              <select
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                value={createTemplateId}
                onChange={(event) => setCreateTemplateId(event.target.value)}
                disabled={templatesLoading || templates.length === 0}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {selectedTemplate ? (
                <p className="text-xs text-slate-400">
                  {selectedTemplate.minPlayers}-{selectedTemplate.maxPlayers} players
                  {selectedTemplate.requiresEntitlement ? ' | Pro template' : ''}
                </p>
              ) : null}
              <button
                className="w-full rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={pending || !activeMaskId || !createTemplateId}
              >
                {pending ? 'Creating...' : 'Create Room'}
              </button>
            </form>

            <form onSubmit={onJoinRoom} className="masq-panel-muted shrink-0 space-y-2 rounded-xl p-2.5">
              <h2 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Join Narrative</h2>
              <input
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-xs text-white focus:border-neon-400"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="Join code"
                required
              />
              <button
                className="w-full rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={pending || !activeMaskId}
              >
                Join By Code
              </button>
            </form>

            {!selectedRoomId || !roomState ? (
              <div className="masq-panel-muted rounded-xl p-3 text-xs text-slate-500">
                Join a narrative room to view members, readiness, and role reveals.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-ink-700 bg-ink-900/78 p-3">
                  <h3 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Members</h3>
                  <div className="mt-2 space-y-2">
                    {roomState.members.map((member) => {
                      const isMemberHost = member.membership.maskId === roomState.room.hostMaskId;
                      return (
                        <div key={member.membership.id} className="rounded-lg border border-ink-700 bg-ink-800/70 p-2.5">
                          <div className="flex items-center gap-2">
                            <MaskAvatar
                              displayName={member.mask.displayName}
                              color={member.mask.color}
                              avatarUploadId={member.mask.avatarUploadId}
                              auraColor={auraByMaskId[member.mask.maskId]?.color ?? member.mask.aura?.color}
                              sizeClassName="h-6 w-6"
                              textClassName="text-[9px]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{member.mask.displayName}</p>
                              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                                {isMemberHost ? 'Host' : 'Member'}
                              </p>
                            </div>
                            <AuraBadge aura={auraByMaskId[member.mask.maskId] ?? member.mask.aura} />
                          </div>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            {member.membership.isReady ? 'Ready' : 'Not ready'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {roomState.room.status === 'ENDED' ? (
                  <div className="rounded-xl border border-ink-700 bg-ink-900/78 p-3">
                    <h3 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Session Summary</h3>
                    {sessionSummary ? (
                      <p className="mt-1 text-xs text-slate-300">
                        Duration {formatDuration(sessionSummary.durationSec)} | Participants {sessionSummary.participantCount}
                      </p>
                    ) : null}
                    <div className="mt-2 space-y-1">
                      {revealedRoles.map((assignment) => (
                        <p key={assignment.id} className="text-xs text-slate-300">
                          {(roleLabelByMaskId[assignment.maskId] ?? assignment.maskId.slice(0, 8))} - {assignment.roleKey}
                        </p>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={onPlayAgain}
                      disabled={pending || !activeMaskId}
                      className="mt-3 w-full rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Play Again
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
