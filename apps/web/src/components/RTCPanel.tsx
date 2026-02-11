import { type RtcContextType, type VoiceParticipant } from '@masq/shared';
import {
  Room as LiveRoom,
  RoomEvent,
  Track,
  type Participant,
} from 'livekit-client';
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import {
  ApiError,
  createRtcSession,
  endRtcSession,
  leaveRtcSession,
  muteRtcParticipant,
} from '../lib/api';

interface RTCPanelProps {
  contextType: RtcContextType;
  contextId: string | null;
  maskId: string | null;
  actorMaskId?: string | null;
  canModerate?: boolean;
  canEndCall?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  title?: string;
}

interface ParticipantView {
  participant: Participant;
  metadata: {
    userId: string;
    maskId: string;
    displayName: string;
    color: string;
    avatarSeed: string;
    contextType: RtcContextType;
    contextId: string;
  } | null;
  audioTrack: Track | null;
  cameraTrack: Track | null;
  screenTrack: Track | null;
  isLocal: boolean;
}

const ParticipantMetadataSchema = z.object({
  userId: z.string().uuid(),
  maskId: z.string().uuid(),
  displayName: z.string().min(1).max(40),
  color: z.string().min(1).max(32),
  avatarSeed: z.string().min(1).max(80),
  contextType: z.enum(['SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM']),
  contextId: z.string().uuid(),
});

const parseParticipantMetadata = (metadata: string | undefined) => {
  if (!metadata) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return null;
  }

  const result = ParticipantMetadataSchema.safeParse(parsed);
  return result.success ? result.data : null;
};

const findTrackBySource = (participant: Participant, source: Track.Source): Track | null => {
  for (const publication of participant.trackPublications.values()) {
    if (publication.source !== source) {
      continue;
    }

    if (publication.track) {
      return publication.track;
    }
  }

  return null;
};

const MediaTrack = ({
  track,
  kind,
  muted,
}: {
  track: Track | null;
  kind: 'video' | 'audio';
  muted?: boolean;
}) => {
  const elementRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!track || !element) {
      return;
    }

    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  if (kind === 'video') {
    return <video ref={elementRef as React.RefObject<HTMLVideoElement>} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />;
  }

  return <audio ref={elementRef as React.RefObject<HTMLAudioElement>} autoPlay muted={muted} />;
};

export function RTCPanel({
  contextType,
  contextId,
  maskId,
  actorMaskId,
  canModerate = false,
  canEndCall = false,
  disabled = false,
  disabledReason,
  title = 'Voice / Video',
}: RTCPanelProps) {
  const roomRef = useRef<LiveRoom | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [livekitRoomName, setLivekitRoomName] = useState<string | null>(null);
  const [participantsSnapshot, setParticipantsSnapshot] = useState<VoiceParticipant[]>([]);
  const [renderVersion, setRenderVersion] = useState(0);

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);

  const bumpRender = useCallback(() => {
    setRenderVersion((current) => current + 1);
  }, []);

  const cleanupRoom = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      return;
    }

    room.removeAllListeners();
    room.disconnect();
    roomRef.current = null;
    bumpRender();
  }, [bumpRender]);

  const leaveCurrentSession = useCallback(
    async (notifyApi: boolean) => {
      const activeSessionId = sessionIdRef.current;

      cleanupRoom();
      sessionIdRef.current = null;
      setSessionId(null);
      setLivekitRoomName(null);
      setStatus('disconnected');
      setMicEnabled(false);
      setCameraEnabled(false);
      setScreenEnabled(false);
      setParticipantsSnapshot([]);

      if (notifyApi && activeSessionId) {
        try {
          await leaveRtcSession(activeSessionId);
        } catch {
          // ignore API leave errors during local cleanup
        }
      }
    },
    [cleanupRoom],
  );

  useEffect(() => {
    return () => {
      void leaveCurrentSession(true);
    };
  }, [leaveCurrentSession]);

  useEffect(() => {
    if (!sessionIdRef.current) {
      return;
    }

    void leaveCurrentSession(true);
  }, [contextId, maskId, leaveCurrentSession]);

  const participantViews = useMemo(() => {
    void renderVersion;
    const room = roomRef.current;
    if (!room) {
      return [] as ParticipantView[];
    }

    const participants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    return participants.map((participant) => ({
      participant,
      metadata: parseParticipantMetadata(participant.metadata),
      audioTrack: findTrackBySource(participant, Track.Source.Microphone),
      cameraTrack: findTrackBySource(participant, Track.Source.Camera),
      screenTrack: findTrackBySource(participant, Track.Source.ScreenShare),
      isLocal: participant.isLocal,
    }));
  }, [renderVersion]);

  const mutedMaskIds = useMemo(() => {
    return new Set(
      participantsSnapshot
        .filter((participant) => participant.isServerMuted)
        .map((participant) => participant.maskId),
    );
  }, [participantsSnapshot]);

  const selfServerMuted = Boolean(maskId && mutedMaskIds.has(maskId));

  useEffect(() => {
    if (!selfServerMuted) {
      return;
    }

    const room = roomRef.current;
    if (!room) {
      return;
    }

    void room.localParticipant.setMicrophoneEnabled(false);
    void room.localParticipant.setCameraEnabled(false);
    void room.localParticipant.setScreenShareEnabled(false);
    setMicEnabled(false);
    setCameraEnabled(false);
    setScreenEnabled(false);
  }, [selfServerMuted]);

  const activeScreenShare = participantViews.find((view) => view.screenTrack);
  const listParticipants = activeScreenShare
    ? participantViews.filter((view) => view.participant.identity !== activeScreenShare.participant.identity)
    : participantViews;
  const anotherScreenShareActive = Boolean(
    activeScreenShare && !(activeScreenShare.isLocal && screenEnabled),
  );

  const onJoin = useCallback(async () => {
    if (!contextId || !maskId || disabled) {
      return;
    }

    setError(null);
    setStatus('connecting');

    try {
      const response = await createRtcSession({
        contextType,
        contextId,
        maskId,
      });

      const room = new LiveRoom();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, bumpRender);
      room.on(RoomEvent.ParticipantDisconnected, bumpRender);
      room.on(RoomEvent.TrackPublished, bumpRender);
      room.on(RoomEvent.TrackUnpublished, bumpRender);
      room.on(RoomEvent.TrackSubscribed, bumpRender);
      room.on(RoomEvent.TrackUnsubscribed, bumpRender);
      room.on(RoomEvent.LocalTrackPublished, bumpRender);
      room.on(RoomEvent.LocalTrackUnpublished, bumpRender);
      room.on(RoomEvent.ActiveSpeakersChanged, bumpRender);
      room.on(RoomEvent.ConnectionStateChanged, bumpRender);
      room.on(RoomEvent.ParticipantMetadataChanged, bumpRender);
      room.on(RoomEvent.Disconnected, () => {
        sessionIdRef.current = null;
        setSessionId(null);
        setParticipantsSnapshot([]);
        setMicEnabled(false);
        setCameraEnabled(false);
        setScreenEnabled(false);
        setStatus('disconnected');
        bumpRender();
      });

      await room.connect(response.livekitUrl, response.token, {
        autoSubscribe: true,
      });

      await room.localParticipant.setMicrophoneEnabled(true);

      sessionIdRef.current = response.voiceSessionId;
      setSessionId(response.voiceSessionId);
      setLivekitRoomName(response.livekitRoomName);
      setParticipantsSnapshot(response.participants);
      setMicEnabled(true);
      setCameraEnabled(false);
      setScreenEnabled(false);
      setStatus('connected');
      bumpRender();
    } catch (err) {
      cleanupRoom();
      sessionIdRef.current = null;
      setSessionId(null);
      setLivekitRoomName(null);
      setStatus('idle');
      setMicEnabled(false);
      setCameraEnabled(false);
      setScreenEnabled(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to join RTC session');
      }
    }
  }, [bumpRender, cleanupRoom, contextId, contextType, disabled, maskId]);

  const onLeave = useCallback(async () => {
    await leaveCurrentSession(true);
  }, [leaveCurrentSession]);

  const onToggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || selfServerMuted) {
      return;
    }

    const next = !micEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
      setError(null);
    } catch {
      setError('Unable to update microphone');
    }
  }, [micEnabled, selfServerMuted]);

  const onToggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room || selfServerMuted) {
      return;
    }

    const next = !cameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
      setError(null);
    } catch {
      setError('Unable to update camera');
    }
  }, [cameraEnabled, selfServerMuted]);

  const onToggleScreen = useCallback(async () => {
    const room = roomRef.current;
    if (!room || selfServerMuted) {
      return;
    }

    const next = !screenEnabled;
    if (next && anotherScreenShareActive) {
      setError('Another participant is already sharing a screen');
      return;
    }

    try {
      await room.localParticipant.setScreenShareEnabled(next, { audio: false });
      setScreenEnabled(next);
      setError(null);
    } catch {
      setError('Unable to toggle screen share');
    }
  }, [anotherScreenShareActive, screenEnabled, selfServerMuted]);

  const onMuteParticipant = useCallback(
    async (targetMaskId: string) => {
      if (!sessionIdRef.current || !actorMaskId) {
        return;
      }

      try {
        const response = await muteRtcParticipant(sessionIdRef.current, {
          actorMaskId,
          targetMaskId,
        });
        setParticipantsSnapshot(response.participants);
        setError(null);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          return;
        }

        setError('Unable to mute participant');
      }
    },
    [actorMaskId],
  );

  const onEndCall = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId || !actorMaskId) {
      return;
    }

    try {
      await endRtcSession(currentSessionId, {
        actorMaskId,
      });
      await leaveCurrentSession(false);
      setStatus('idle');
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        return;
      }

      setError('Unable to end call');
    }
  }, [actorMaskId, leaveCurrentSession]);

  const renderParticipantTile = (view: ParticipantView): ReactElement => {
    const metadata = view.metadata;
    const displayName = metadata?.displayName ?? (view.isLocal ? 'You' : view.participant.identity);
    const color = metadata?.color ?? '#8ff5ff';
    const avatarSeed = metadata?.avatarSeed ?? 'mask';
    const participantMaskId = metadata?.maskId ?? null;
    const isMutedByServer = Boolean(participantMaskId && mutedMaskIds.has(participantMaskId));

    return (
      <div key={view.participant.identity} className="rounded-xl border border-ink-700 bg-ink-900/70 p-2">
        <div className="relative h-40 overflow-hidden rounded-lg border border-ink-700 bg-ink-800">
          {view.screenTrack ? <MediaTrack track={view.screenTrack} kind="video" muted={view.isLocal} /> : null}
          {!view.screenTrack && view.cameraTrack ? <MediaTrack track={view.cameraTrack} kind="video" muted={view.isLocal} /> : null}
          {!view.screenTrack && !view.cameraTrack ? (
            <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.15em] text-slate-500">
              audio only
            </div>
          ) : null}
          {view.audioTrack ? <MediaTrack track={view.audioTrack} kind="audio" muted={view.isLocal} /> : null}

          <div className="absolute left-2 top-2 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{displayName}</span>
            {view.participant.isSpeaking ? <span className="text-neon-300">speaking</span> : null}
          </div>
        </div>

        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">{avatarSeed}</p>
        {isMutedByServer ? (
          <p className="mt-1 text-[11px] text-amber-200">Server-muted</p>
        ) : null}

        {canModerate && actorMaskId && participantMaskId && !view.isLocal ? (
          <button
            type="button"
            className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-200 hover:border-amber-400"
            onClick={() => {
              void onMuteParticipant(participantMaskId);
            }}
          >
            Mute
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</h4>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            {status}
            {livekitRoomName ? ` - ${livekitRoomName}` : ''}
            {selfServerMuted ? ' - server muted' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sessionId ? (
            <button
              type="button"
              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-rose-200 hover:border-rose-400"
              onClick={() => {
                void onLeave();
              }}
            >
              Leave
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md border border-neon-400/40 bg-neon-400/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-neon-300 hover:border-neon-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                void onJoin();
              }}
              disabled={status === 'connecting' || !contextId || !maskId || disabled}
            >
              {status === 'connecting' ? 'Joining...' : 'Join Call'}
            </button>
          )}

          <button
            type="button"
            className="rounded-md border border-ink-700 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void onToggleMic();
            }}
            disabled={!sessionId || selfServerMuted}
          >
            {micEnabled ? 'Mic On' : 'Mic Off'}
          </button>

          <button
            type="button"
            className="rounded-md border border-ink-700 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void onToggleCamera();
            }}
            disabled={!sessionId || selfServerMuted}
          >
            {cameraEnabled ? 'Cam On' : 'Cam Off'}
          </button>

          <button
            type="button"
            className="rounded-md border border-ink-700 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void onToggleScreen();
            }}
            disabled={!sessionId || selfServerMuted}
          >
            {screenEnabled ? 'Stop Share' : 'Share Screen'}
          </button>

          {canEndCall && actorMaskId && sessionId ? (
            <button
              type="button"
              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-rose-200 hover:border-rose-400"
              onClick={() => {
                void onEndCall();
              }}
            >
              End Call
            </button>
          ) : null}
        </div>
      </div>

      {disabled && disabledReason ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">{disabledReason}</p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{error}</p>
      ) : null}

      {activeScreenShare ? (
        <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-2">
          <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-cyan-300">Screen Share</p>
          {renderParticipantTile(activeScreenShare)}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {listParticipants.length === 0 ? (
          <p className="text-xs text-slate-500">No active RTC participants.</p>
        ) : (
          listParticipants.map(renderParticipantTile)
        )}
      </div>
    </div>
  );
}
