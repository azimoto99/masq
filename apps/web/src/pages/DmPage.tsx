import {
  ClientSocketEventSchema,
  MAX_ROOM_MESSAGE_LENGTH,
  ServerSocketEventSchema,
  type DmMessage,
  type DmParticipantState,
  type FriendUser,
  type MeResponse,
} from '@masq/shared';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ApiError,
  buildUploadUrl,
  getDmThread,
  sendFriendRequest,
  setDmMask,
  uploadImage,
} from '../lib/api';
import { MaskAvatar } from '../components/MaskAvatar';
import { RTCPanel } from '../components/RTCPanel';
import { SpacesSidebar } from '../components/SpacesSidebar';

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
  const params = useParams<{ threadId: string }>();
  const selectedThreadId = params.threadId ?? null;
  const socketRef = useRef<WebSocket | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

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
  const [composerImageFile, setComposerImageFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [savingMask, setSavingMask] = useState(false);
  const [friendRequestPendingUserId, setFriendRequestPendingUserId] = useState<string | null>(null);
  const [friendRequestNotice, setFriendRequestNotice] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);

  const activeMask = useMemo(
    () => me.masks.find((mask) => mask.id === activeMaskId) ?? null,
    [activeMaskId, me.masks],
  );

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
    setMobileSidebarOpen(false);
    setMobileContextOpen(false);
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

  const onSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setSocketError('Socket is not connected');
      return;
    }

    if (!selectedThreadId || !activeMaskId || (!composerBody.trim() && !composerImageFile)) {
      return;
    }

    setSendingMessage(true);
    setSocketError(null);
    try {
      let imageUploadId: string | undefined;
      if (composerImageFile) {
        const upload = await uploadImage(
          {
            contextType: 'DM_THREAD',
            contextId: selectedThreadId,
          },
          composerImageFile,
        );
        imageUploadId = upload.upload.id;
      }

      const sendEvent = ClientSocketEventSchema.parse({
        type: 'SEND_DM',
        data: {
          threadId: selectedThreadId,
          maskId: activeMaskId,
          body: composerBody,
          imageUploadId,
        },
      });
      socketRef.current.send(JSON.stringify(sendEvent));
      setComposerBody('');
      setComposerImageFile(null);
    } catch (err) {
      setSocketError(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const onSwitchMask = async (nextMaskId: string) => {
    if (!selectedThreadId) {
      setActiveMaskId(nextMaskId);
      window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, nextMaskId);
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
    } catch (err) {
      setSocketError(err instanceof ApiError ? err.message : 'Failed to switch mask');
    } finally {
      setSavingMask(false);
    }
  };

  const onSendFriendRequestByUserId = async (targetUserId: string) => {
    if (targetUserId === me.user.id) {
      return;
    }

    setFriendRequestPendingUserId(targetUserId);
    setFriendRequestNotice(null);
    setSocketError(null);
    try {
      await sendFriendRequest({ toUserId: targetUserId });
      setFriendRequestNotice('Friend request sent');
    } catch (err) {
      setSocketError(err instanceof ApiError ? err.message : 'Failed to send friend request');
    } finally {
      setFriendRequestPendingUserId(null);
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

  const fallbackMaskId = window.localStorage.getItem(ACTIVE_MASK_STORAGE_KEY) ?? me.masks[0]?.id ?? null;

  return (
    <div className="mx-auto w-full max-w-[1520px]">
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

      <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} order-2 xl:order-1 xl:block xl:sticky xl:top-4 xl:h-[calc(100vh-3rem)] xl:overflow-hidden`}>
          <div className="flex h-full flex-col gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300 xl:hidden"
            >
              Close Spaces
            </button>

            <SpacesSidebar className="flex-1 min-h-0" activeMaskId={activeMaskId ?? fallbackMaskId} />

            <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-2.5">
              <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">
                Active DM Mask
              </label>
              <select
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-white focus:border-neon-400"
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
              {activeMask ? (
                <div className="mt-2 flex items-center gap-2">
                  <MaskAvatar
                    displayName={activeMask.displayName}
                    color={activeMask.color}
                    avatarUploadId={activeMask.avatarUploadId}
                    sizeClassName="h-6 w-6"
                    textClassName="text-[9px]"
                  />
                  <p className="truncate text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    {activeMask.avatarSeed}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <main className="order-1 xl:order-2 rounded-2xl border border-ink-700 bg-ink-800/80 p-3 xl:h-[calc(100vh-3rem)] xl:overflow-hidden">
          <div className="flex h-full flex-col gap-3">
            {!selectedThreadId ? (
              <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-4 text-sm text-slate-500">
                Select a DM thread from the left Spaces list.
              </div>
            ) : pageError ? (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {pageError}
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-3">
                  <h2 className="text-lg font-semibold text-white">
                    {peer?.defaultMask?.displayName ?? 'Direct Message'}
                  </h2>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    {socketStatus} {activeMask ? `- speaking as ${activeMask.displayName}` : ''}
                  </p>

                  {socketError ? (
                    <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
                      {socketError}
                    </div>
                  ) : null}
                  {friendRequestNotice ? (
                    <div className="mt-3 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-xs text-cyan-200">
                      {friendRequestNotice}
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

                <div
                  ref={messageListRef}
                  className="min-h-[240px] flex-1 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900/70 p-3"
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
                              sizeClassName="h-6 w-6"
                              textClassName="text-[9px]"
                            />
                            <span className="font-medium text-white">{message.mask.displayName}</span>
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

                <form onSubmit={onSendMessage} className="rounded-xl border border-ink-700 bg-ink-900/70 p-3">
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">Message</label>
                  <textarea
                    className="h-24 w-full resize-none rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white focus:border-neon-400"
                    value={composerBody}
                    onChange={(event) => setComposerBody(event.target.value)}
                    placeholder="Speak through your mask"
                    maxLength={MAX_ROOM_MESSAGE_LENGTH}
                    disabled={socketStatus !== 'connected' || sendingMessage}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="cursor-pointer rounded-md border border-ink-700 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 hover:border-neon-400 hover:text-neon-100">
                      Attach Image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={socketStatus !== 'connected' || sendingMessage}
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
                    <p className="text-xs text-slate-500">
                      {composerBody.length}/{MAX_ROOM_MESSAGE_LENGTH}
                    </p>
                    <button
                      type="submit"
                      className="rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-neon-200 transition hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        socketStatus !== 'connected' ||
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

        <aside className={`${mobileContextOpen ? 'block' : 'hidden'} order-3 xl:order-3 xl:block rounded-2xl border border-ink-700 bg-ink-800/80 p-3 xl:h-[calc(100vh-3rem)] xl:overflow-hidden`}>
          <div className="flex h-full flex-col gap-3">
            <button
              type="button"
              onClick={() => setMobileContextOpen(false)}
              className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300 xl:hidden"
            >
              Close Context
            </button>
            {!selectedThreadId ? (
              <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-3 text-xs text-slate-500">
                Select a DM thread to view participants.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900/70 p-3">
                <h3 className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Participants</h3>
                <div className="mt-2 space-y-2">
                  {participants.length === 0 ? <p className="text-xs text-slate-500">No participants.</p> : null}
                  {participants.map((participant) => (
                    <div key={participant.userId} className="rounded-lg border border-ink-700 bg-ink-800/80 p-2.5">
                      <div className="flex items-center gap-2">
                        <MaskAvatar
                          displayName={participant.mask.displayName}
                          color={participant.mask.color}
                          avatarUploadId={participant.mask.avatarUploadId}
                          sizeClassName="h-6 w-6"
                          textClassName="text-[9px]"
                        />
                        <p className="text-sm font-medium text-white">{participant.mask.displayName}</p>
                      </div>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        {participant.mask.avatarSeed}
                      </p>
                      {participant.userId !== me.user.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            void onSendFriendRequestByUserId(participant.userId);
                          }}
                          disabled={friendRequestPendingUserId === participant.userId}
                          className="mt-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {friendRequestPendingUserId === participant.userId ? 'Sending...' : 'Add Friend'}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
