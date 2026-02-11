import {
  ClientSocketEventSchema,
  MAX_ROOM_MESSAGE_LENGTH,
  ServerSocketEventSchema,
  type DmMessage,
  type DmParticipantState,
  type DmThreadListItem,
  type FriendUser,
  type MeResponse,
} from '@masq/shared';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, getDmThread, listDmThreads, setDmMask } from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';
import { RTCPanel } from '../components/RTCPanel';

interface DmPageProps {
  me: MeResponse;
}

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';

const buildWebSocketUrl = () => {
  const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (configuredApiUrl) {
    const url = new URL(configuredApiUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    return url.toString();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}://${window.location.host}/ws`;
};

const formatTimestamp = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

export function DmPage({ me }: DmPageProps) {
  const navigate = useNavigate();
  const params = useParams<{ threadId: string }>();
  const selectedThreadId = params.threadId ?? null;
  const socketRef = useRef<WebSocket | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const [threads, setThreads] = useState<DmThreadListItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const [peer, setPeer] = useState<FriendUser | null>(null);
  const [participants, setParticipants] = useState<DmParticipantState[]>([]);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);

  const [socketStatus, setSocketStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>(
    'idle',
  );
  const [socketError, setSocketError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [composerBody, setComposerBody] = useState('');
  const [savingMask, setSavingMask] = useState(false);

  const activeMask = useMemo(
    () => me.masks.find((mask) => mask.id === activeMaskId) ?? null,
    [activeMaskId, me.masks],
  );

  const loadThreads = async () => {
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      const response = await listDmThreads();
      setThreads(response.threads);
    } catch (err) {
      setThreadsError(err instanceof ApiError ? err.message : 'Failed to load DM threads');
    } finally {
      setThreadsLoading(false);
    }
  };

  useEffect(() => {
    void loadThreads();
  }, []);

  useEffect(() => {
    if (!selectedThreadId) {
      setPeer(null);
      setParticipants([]);
      setMessages([]);
      setActiveMaskId(null);
      setPageError(null);
      return;
    }

    let cancelled = false;

    const loadThread = async () => {
      setPageError(null);
      try {
        const response = await getDmThread(selectedThreadId);
        if (cancelled) {
          return;
        }

        setPeer(response.peer);
        setParticipants(response.participants);
        setMessages(response.messages);
        setActiveMaskId(response.activeMask.maskId);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setPageError(err instanceof ApiError ? err.message : 'Failed to load DM thread');
      }
    };

    void loadThread();

    return () => {
      cancelled = true;
    };
  }, [selectedThreadId]);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.close();
      socketRef.current = null;
    }

    setSocketError(null);

    if (!selectedThreadId || !activeMaskId) {
      setSocketStatus('idle');
      return;
    }

    const ws = new WebSocket(buildWebSocketUrl());
    socketRef.current = ws;
    setSocketStatus('connecting');

    ws.onopen = () => {
      setSocketStatus('connected');
      const joinEvent = ClientSocketEventSchema.parse({
        type: 'JOIN_DM',
        data: {
          threadId: selectedThreadId,
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
      if (socketEvent.type === 'DM_STATE') {
        if (socketEvent.data.threadId !== selectedThreadId) {
          return;
        }

        setParticipants(socketEvent.data.participants);
        setMessages(socketEvent.data.recentMessages);
        return;
      }

      if (socketEvent.type === 'NEW_DM_MESSAGE') {
        if (socketEvent.data.threadId !== selectedThreadId) {
          return;
        }

        setMessages((current) => [...current, socketEvent.data.message]);
        void loadThreads();
        return;
      }

      if (socketEvent.type === 'ERROR') {
        setSocketError(socketEvent.data.message);
      }
    };

    ws.onclose = () => {
      setSocketStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, [activeMaskId, selectedThreadId]);

  const onSelectThread = (threadId: string) => {
    navigate(`/dm/${threadId}`);
  };

  const onSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setSocketError('Socket is not connected');
      return;
    }

    if (!selectedThreadId || !activeMaskId || !composerBody.trim()) {
      return;
    }

    const sendEvent = ClientSocketEventSchema.parse({
      type: 'SEND_DM',
      data: {
        threadId: selectedThreadId,
        maskId: activeMaskId,
        body: composerBody,
      },
    });
    socketRef.current.send(JSON.stringify(sendEvent));
    setComposerBody('');
  };

  const onSwitchMask = async (nextMaskId: string) => {
    if (!selectedThreadId) {
      return;
    }

    setSavingMask(true);
    setSocketError(null);
    try {
      const response = await setDmMask(selectedThreadId, {
        maskId: nextMaskId,
      });
      setActiveMaskId(response.activeMask.maskId);
      window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, response.activeMask.maskId);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const joinEvent = ClientSocketEventSchema.parse({
          type: 'JOIN_DM',
          data: {
            threadId: selectedThreadId,
            maskId: response.activeMask.maskId,
          },
        });
        socketRef.current.send(JSON.stringify(joinEvent));
      }

      await loadThreads();
    } catch (err) {
      setSocketError(err instanceof ApiError ? err.message : 'Failed to switch mask');
    } finally {
      setSavingMask(false);
    }
  };

  useEffect(() => {
    if (activeMaskId) {
      return;
    }

    const persisted = window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY);
    if (!persisted) {
      return;
    }

    const owned = me.masks.some((mask) => mask.id === persisted);
    if (owned) {
      setActiveMaskId(persisted);
    }
  }, [activeMaskId, me.masks]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-3xl border border-ink-700 bg-ink-800/85 p-6 shadow-2xl shadow-black/40">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <BrandLogo />
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Direct Messages</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Friend DM Threads</h1>
            <p className="mt-2 text-sm text-slate-400">Realtime messages with mask-only identity.</p>
          </div>

          <div className="flex gap-2">
            <Link
              to="/friends"
              className="rounded-lg border border-ink-700 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Friends
            </Link>
            <Link
              to="/masks"
              className="rounded-lg border border-ink-700 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Masks
            </Link>
            <Link
              to="/servers"
              className="rounded-lg border border-ink-700 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Servers
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-4 rounded-3xl border border-ink-700 bg-ink-800/80 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">Threads</h2>
            <button
              type="button"
              className="rounded-md border border-ink-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white"
              onClick={() => {
                void loadThreads();
              }}
            >
              Refresh
            </button>
          </div>

          {threadsLoading ? <p className="text-xs text-slate-500">Loading...</p> : null}
          {threadsError ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
              {threadsError}
            </p>
          ) : null}
          {!threadsLoading && threads.length === 0 ? <p className="text-xs text-slate-500">No DM threads yet.</p> : null}

          <div className="space-y-2">
            {threads.map((item) => (
              <button
                key={item.thread.id}
                type="button"
                onClick={() => onSelectThread(item.thread.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                  selectedThreadId === item.thread.id
                    ? 'border-neon-400/60 bg-neon-400/10 text-white'
                    : 'border-ink-700 bg-ink-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-medium">{item.peer.defaultMask?.displayName ?? item.peer.email}</div>
                <div className="mt-1 truncate text-[10px] text-slate-500">
                  {item.lastMessage ? item.lastMessage.body : 'No messages yet'}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-3xl border border-ink-700 bg-ink-800/80 p-5">
          {!selectedThreadId ? (
            <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-6 text-sm text-slate-400">
              Pick a DM thread from the list, or start one from Friends.
            </div>
          ) : pageError ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {pageError}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr,240px]">
              <section className="space-y-4">
                <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {peer?.defaultMask?.displayName ?? peer?.email ?? 'Direct Message'}
                      </h2>
                      <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                        {socketStatus} {activeMask ? `- speaking as ${activeMask.displayName}` : ''}
                      </p>
                    </div>

                    <div className="w-full md:w-64">
                      <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-slate-500">
                        Active Mask
                      </label>
                      <select
                        className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                        value={activeMaskId ?? ''}
                        onChange={(event) => {
                          void onSwitchMask(event.target.value);
                        }}
                        disabled={savingMask}
                      >
                        {me.masks.map((mask) => (
                          <option key={mask.id} value={mask.id}>
                            {mask.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {socketError ? (
                    <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                      {socketError}
                    </div>
                  ) : null}
                </div>

                <RTCPanel
                  title="DM RTC"
                  contextType="DM_THREAD"
                  contextId={selectedThreadId}
                  maskId={activeMaskId}
                  actorMaskId={activeMaskId}
                  canEndCall={Boolean(activeMaskId)}
                  disabled={!activeMaskId}
                  disabledReason={activeMaskId ? undefined : 'Select an active mask to join call.'}
                />

                <div ref={messageListRef} className="h-[420px] overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900/70 p-4">
                  <div className="space-y-3">
                    {messages.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : null}
                    {messages.map((message) => (
                      <article key={message.id} className="rounded-xl border border-ink-700 bg-ink-800/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: message.mask.color }} />
                            <span className="font-medium text-white">{message.mask.displayName}</span>
                            <span className="text-xs text-slate-500">{message.mask.avatarSeed}</span>
                          </div>
                          <span className="text-xs text-slate-500">{formatTimestamp(message.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">{message.body}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <form onSubmit={onSendMessage} className="rounded-2xl border border-ink-700 bg-ink-900/70 p-4">
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Message</label>
                  <textarea
                    className="h-24 w-full resize-none rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                    value={composerBody}
                    onChange={(event) => setComposerBody(event.target.value)}
                    placeholder="Speak through your mask"
                    maxLength={MAX_ROOM_MESSAGE_LENGTH}
                    disabled={socketStatus !== 'connected'}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {composerBody.length}/{MAX_ROOM_MESSAGE_LENGTH}
                    </p>
                    <button
                      type="submit"
                      className="rounded-xl border border-neon-400/40 bg-neon-400/10 px-4 py-2 text-sm font-medium text-neon-400 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={socketStatus !== 'connected'}
                    >
                      Send
                    </button>
                  </div>
                </form>
              </section>

              <aside className="rounded-2xl border border-ink-700 bg-ink-900/70 p-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500">Participants</h3>
                <div className="mt-3 space-y-2">
                  {participants.length === 0 ? <p className="text-xs text-slate-500">No participants.</p> : null}
                  {participants.map((participant) => (
                    <div key={participant.userId} className="rounded-xl border border-ink-700 bg-ink-800/80 p-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: participant.mask.color }} />
                        <p className="text-sm font-medium text-white">{participant.mask.displayName}</p>
                      </div>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">{participant.mask.avatarSeed}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
