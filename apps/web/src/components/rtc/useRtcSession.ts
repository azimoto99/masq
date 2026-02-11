import { type RtcContextType, type VoiceParticipant } from '@masq/shared';
import { ConnectionState, Room as LiveRoom, RoomEvent, Track, type Participant } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { ApiError, createRtcSession, endRtcSession, leaveRtcSession, muteRtcParticipant } from '../../lib/api';
import type { RtcConnectionState, RtcDeviceState, RtcParticipantView } from './types';

interface UseRtcSessionOptions {
  contextType: RtcContextType;
  contextId: string | null;
  maskId: string | null;
  actorMaskId?: string | null;
  canModerate?: boolean;
  canEndCall?: boolean;
  disabled?: boolean;
}

interface ParticipantMetadata {
  userId: string;
  maskId: string;
  displayName: string;
  color: string;
  avatarSeed: string;
  contextType: RtcContextType;
  contextId: string;
}

const DEVICE_STORAGE_KEYS = {
  audioInput: 'masq.rtc.audioinput',
  audioOutput: 'masq.rtc.audiooutput',
  videoInput: 'masq.rtc.videoinput',
} as const;

const ParticipantMetadataSchema = z.object({
  userId: z.string().uuid(),
  maskId: z.string().uuid(),
  displayName: z.string().min(1).max(40),
  color: z.string().min(1).max(32),
  avatarSeed: z.string().min(1).max(80),
  contextType: z.enum(['SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM']),
  contextId: z.string().uuid(),
});

const defaultDeviceState: RtcDeviceState = {
  audioInputs: [],
  audioOutputs: [],
  videoInputs: [],
  selectedAudioInputId: '',
  selectedAudioOutputId: '',
  selectedVideoInputId: '',
};

const parseParticipantMetadata = (metadata: string | undefined): ParticipantMetadata | null => {
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

const readPreferredDevice = (key: string) => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(key) ?? '';
};

const writePreferredDevice = (key: string, value: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (value) {
    window.localStorage.setItem(key, value);
  } else {
    window.localStorage.removeItem(key);
  }
};

const mapConnectionState = (state: ConnectionState): RtcConnectionState => {
  switch (state) {
    case ConnectionState.Connected:
      return 'connected';
    case ConnectionState.Connecting:
      return 'connecting';
    case ConnectionState.Reconnecting:
      return 'reconnecting';
    case ConnectionState.Disconnected:
    default:
      return 'disconnected';
  }
};

const isContextValid = (value: string | null): value is string => {
  return Boolean(value && value.length > 0);
};

export function useRtcSession({
  contextType,
  contextId,
  maskId,
  actorMaskId,
  canModerate = false,
  canEndCall = false,
  disabled = false,
}: UseRtcSessionOptions) {
  const roomRef = useRef<LiveRoom | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [connectionState, setConnectionState] = useState<RtcConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [livekitRoomName, setLivekitRoomName] = useState<string | null>(null);
  const [participantsSnapshot, setParticipantsSnapshot] = useState<VoiceParticipant[]>([]);
  const [renderVersion, setRenderVersion] = useState(0);

  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [deafened, setDeafened] = useState(false);

  const [devices, setDevices] = useState<RtcDeviceState>(() => ({
    ...defaultDeviceState,
    selectedAudioInputId: readPreferredDevice(DEVICE_STORAGE_KEYS.audioInput),
    selectedAudioOutputId: readPreferredDevice(DEVICE_STORAGE_KEYS.audioOutput),
    selectedVideoInputId: readPreferredDevice(DEVICE_STORAGE_KEYS.videoInput),
  }));

  const bumpRender = useCallback(() => {
    setRenderVersion((current) => current + 1);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = all.filter((item) => item.kind === 'audioinput');
      const audioOutputs = all.filter((item) => item.kind === 'audiooutput');
      const videoInputs = all.filter((item) => item.kind === 'videoinput');

      setDevices((current) => ({
        audioInputs,
        audioOutputs,
        videoInputs,
        selectedAudioInputId: current.selectedAudioInputId || audioInputs[0]?.deviceId || '',
        selectedAudioOutputId: current.selectedAudioOutputId || audioOutputs[0]?.deviceId || '',
        selectedVideoInputId: current.selectedVideoInputId || videoInputs[0]?.deviceId || '',
      }));
    } catch {
      // device enumeration is best-effort
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) {
      return;
    }

    const listener = () => {
      void refreshDevices();
    };

    mediaDevices.addEventListener('devicechange', listener);
    return () => {
      mediaDevices.removeEventListener('devicechange', listener);
    };
  }, [refreshDevices]);

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
      setConnectionState('disconnected');
      setMicEnabled(false);
      setCameraEnabled(false);
      setScreenEnabled(false);
      setDeafened(false);
      setParticipantsSnapshot([]);

      if (notifyApi && activeSessionId) {
        try {
          await leaveRtcSession(activeSessionId);
        } catch {
          // ignore leave errors
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

  const mutedMaskIds = useMemo(() => {
    return new Set(
      participantsSnapshot.filter((participant) => participant.isServerMuted).map((participant) => participant.maskId),
    );
  }, [participantsSnapshot]);

  const participantViews = useMemo(() => {
    void renderVersion;
    const room = roomRef.current;
    if (!room) {
      return [] as RtcParticipantView[];
    }

    const participants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    return participants.map((participant) => {
      const metadata = parseParticipantMetadata(participant.metadata);
      const maskIdFromMeta = metadata?.maskId ?? null;

      return {
        participant,
        identity: participant.identity,
        isLocal: participant.isLocal,
        isSpeaking: participant.isSpeaking,
        metadata: metadata
          ? {
              userId: metadata.userId,
              maskId: metadata.maskId,
              displayName: metadata.displayName,
              color: metadata.color,
              avatarSeed: metadata.avatarSeed,
            }
          : null,
        audioTrack: findTrackBySource(participant, Track.Source.Microphone),
        cameraTrack: findTrackBySource(participant, Track.Source.Camera),
        screenTrack: findTrackBySource(participant, Track.Source.ScreenShare),
        isServerMuted: Boolean(maskIdFromMeta && mutedMaskIds.has(maskIdFromMeta)),
      } satisfies RtcParticipantView;
    });
  }, [mutedMaskIds, renderVersion]);

  const activeScreenShare = useMemo(
    () => participantViews.find((view) => view.screenTrack !== null) ?? null,
    [participantViews],
  );

  const hasVisualMedia = useMemo(
    () => participantViews.some((view) => view.cameraTrack !== null || view.screenTrack !== null),
    [participantViews],
  );

  const speakingCount = useMemo(
    () => participantViews.filter((view) => view.isSpeaking).length,
    [participantViews],
  );

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

  const applyDevicePreference = useCallback(
    async (kind: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => {
      const room = roomRef.current;
      if (!room || !deviceId) {
        return;
      }

      try {
        await room.switchActiveDevice(kind, deviceId);
      } catch {
        // switching output devices can fail on unsupported browsers
      }
    },
    [],
  );

  const applyStoredDevicePreferences = useCallback(async () => {
    const audioInputId = readPreferredDevice(DEVICE_STORAGE_KEYS.audioInput);
    const audioOutputId = readPreferredDevice(DEVICE_STORAGE_KEYS.audioOutput);
    const videoInputId = readPreferredDevice(DEVICE_STORAGE_KEYS.videoInput);

    if (audioInputId) {
      await applyDevicePreference('audioinput', audioInputId);
    }

    if (audioOutputId) {
      await applyDevicePreference('audiooutput', audioOutputId);
    }

    if (videoInputId) {
      await applyDevicePreference('videoinput', videoInputId);
    }
  }, [applyDevicePreference]);

  const setPreferredDevice = useCallback(
    async (kind: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => {
      const key =
        kind === 'audioinput'
          ? DEVICE_STORAGE_KEYS.audioInput
          : kind === 'audiooutput'
            ? DEVICE_STORAGE_KEYS.audioOutput
            : DEVICE_STORAGE_KEYS.videoInput;

      writePreferredDevice(key, deviceId);

      setDevices((current) => ({
        ...current,
        selectedAudioInputId: kind === 'audioinput' ? deviceId : current.selectedAudioInputId,
        selectedAudioOutputId: kind === 'audiooutput' ? deviceId : current.selectedAudioOutputId,
        selectedVideoInputId: kind === 'videoinput' ? deviceId : current.selectedVideoInputId,
      }));

      await applyDevicePreference(kind, deviceId);
    },
    [applyDevicePreference],
  );

  const joinCall = useCallback(async () => {
    if (!isContextValid(contextId) || !maskId || disabled) {
      return;
    }

    setError(null);
    setConnectionState('connecting');

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
      room.on(RoomEvent.ParticipantMetadataChanged, bumpRender);
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        setConnectionState(mapConnectionState(state));
        bumpRender();
      });
      room.on(RoomEvent.Disconnected, () => {
        sessionIdRef.current = null;
        setSessionId(null);
        setParticipantsSnapshot([]);
        setMicEnabled(false);
        setCameraEnabled(false);
        setScreenEnabled(false);
        setConnectionState('disconnected');
        bumpRender();
      });

      await room.connect(response.livekitUrl, response.token, {
        autoSubscribe: true,
      });

      await applyStoredDevicePreferences();
      const shouldStartMuted = response.participants.some(
        (participant) => participant.maskId === maskId && participant.isServerMuted,
      );
      if (!shouldStartMuted) {
        await room.localParticipant.setMicrophoneEnabled(true);
      }

      sessionIdRef.current = response.voiceSessionId;
      setSessionId(response.voiceSessionId);
      setLivekitRoomName(response.livekitRoomName);
      setParticipantsSnapshot(response.participants);
      setMicEnabled(!shouldStartMuted);
      setCameraEnabled(false);
      setScreenEnabled(false);
      setConnectionState('connected');
      bumpRender();
    } catch (err) {
      cleanupRoom();
      sessionIdRef.current = null;
      setSessionId(null);
      setLivekitRoomName(null);
      setConnectionState('idle');
      setMicEnabled(false);
      setCameraEnabled(false);
      setScreenEnabled(false);
      setParticipantsSnapshot([]);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to join call');
      }
    }
  }, [applyStoredDevicePreferences, bumpRender, cleanupRoom, contextId, contextType, disabled, maskId]);

  const leaveCall = useCallback(async () => {
    await leaveCurrentSession(true);
  }, [leaveCurrentSession]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || selfServerMuted || !sessionIdRef.current) {
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

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room || selfServerMuted || !sessionIdRef.current) {
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

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || selfServerMuted || !sessionIdRef.current) {
      return;
    }

    const next = !screenEnabled;
    if (next && activeScreenShare && !activeScreenShare.isLocal) {
      setError('Another participant is already sharing');
      return;
    }

    try {
      await room.localParticipant.setScreenShareEnabled(next, { audio: false });
      setScreenEnabled(next);
      setError(null);
    } catch {
      setError('Unable to toggle screen share');
    }
  }, [activeScreenShare, screenEnabled, selfServerMuted]);

  const toggleDeafened = useCallback(() => {
    setDeafened((current) => !current);
  }, []);

  const muteParticipant = useCallback(
    async (targetMaskId: string) => {
      if (!sessionIdRef.current || !actorMaskId || !canModerate) {
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
        } else {
          setError('Unable to mute participant');
        }
      }
    },
    [actorMaskId, canModerate],
  );

  const endCall = useCallback(async () => {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId || !actorMaskId || !canEndCall) {
      return;
    }

    try {
      await endRtcSession(activeSessionId, {
        actorMaskId,
      });
      await leaveCurrentSession(false);
      setConnectionState('idle');
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to end call');
      }
    }
  }, [actorMaskId, canEndCall, leaveCurrentSession]);

  return {
    room: roomRef.current,
    sessionId,
    livekitRoomName,
    connectionState,
    error,
    participants: participantViews,
    participantsSnapshot,
    hasVisualMedia,
    activeScreenShare,
    speakingCount,
    micEnabled,
    cameraEnabled,
    screenEnabled,
    deafened,
    selfServerMuted,
    canJoin: isContextValid(contextId) && Boolean(maskId) && !disabled,
    canModerate,
    canEndCall,
    disabled,
    joinCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    toggleDeafened,
    muteParticipant,
    endCall,
    devices,
    refreshDevices,
    setPreferredDevice,
    clearError: () => setError(null),
  };
}
