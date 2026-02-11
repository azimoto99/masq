import { type RtcContextType, type VoiceParticipant } from '@masq/shared';
import { ConnectionState, Room as LiveRoom, RoomEvent, Track, type Participant } from 'livekit-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { z } from 'zod';
import { ApiError, createRtcSession, endRtcSession, leaveRtcSession, muteRtcParticipant } from '../lib/api';
import type { RtcConnectionState, RtcDeviceState, RtcParticipantView } from '../components/rtc/types';

export interface RtcJoinScope {
  contextType: RtcContextType;
  contextId: string | null;
  maskId: string | null;
  actorMaskId?: string | null;
  canModerate?: boolean;
  canEndCall?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
}

export interface ActiveRtcContext {
  contextType: RtcContextType;
  contextId: string;
  maskId: string;
  actorMaskId: string | null;
  canModerate: boolean;
  canEndCall: boolean;
  label: string;
}

interface RtcProviderValue {
  room: LiveRoom | null;
  activeContext: ActiveRtcContext | null;
  pendingSwitchContext: ActiveRtcContext | null;
  connectionState: RtcConnectionState;
  error: string | null;
  sessionId: string | null;
  livekitRoomName: string | null;
  participants: RtcParticipantView[];
  participantsSnapshot: VoiceParticipant[];
  hasVisualMedia: boolean;
  activeScreenShare: RtcParticipantView | null;
  speakingCount: number;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  deafened: boolean;
  selfServerMuted: boolean;
  canModerate: boolean;
  canEndCall: boolean;
  devices: RtcDeviceState;
  dockExpanded: boolean;
  devicePickerOpen: boolean;
  toggleDockExpanded: () => void;
  setDockExpanded: (next: boolean) => void;
  openDevicePicker: () => void;
  closeDevicePicker: () => void;
  requestJoin: (scope: RtcJoinScope) => Promise<void>;
  confirmSwitchJoin: () => Promise<void>;
  cancelSwitchJoin: () => void;
  leaveCall: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleDeafened: () => void;
  muteParticipant: (targetMaskId: string) => Promise<void>;
  endCall: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  setPreferredDevice: (kind: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => Promise<void>;
  clearError: () => void;
  syncActiveContext: (scope: RtcJoinScope) => void;
}

export interface ScopedRtcSession {
  room: LiveRoom | null;
  sessionId: string | null;
  livekitRoomName: string | null;
  connectionState: RtcConnectionState;
  error: string | null;
  participants: RtcParticipantView[];
  participantsSnapshot: VoiceParticipant[];
  hasVisualMedia: boolean;
  activeScreenShare: RtcParticipantView | null;
  speakingCount: number;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  deafened: boolean;
  selfServerMuted: boolean;
  canJoin: boolean;
  canModerate: boolean;
  canEndCall: boolean;
  disabled: boolean;
  activeContext: ActiveRtcContext | null;
  isCurrentContext: boolean;
  inAnotherCall: boolean;
  joinCall: () => Promise<void>;
  leaveCall: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleDeafened: () => void;
  muteParticipant: (targetMaskId: string) => Promise<void>;
  endCall: () => Promise<void>;
  devices: RtcDeviceState;
  refreshDevices: () => Promise<void>;
  setPreferredDevice: (kind: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => Promise<void>;
  clearError: () => void;
  openDevicePicker: () => void;
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

const CALL_CONTEXT_STORAGE_KEY = 'masq.rtc.callContext';

const ParticipantMetadataSchema = z.object({
  userId: z.string().uuid(),
  maskId: z.string().uuid(),
  displayName: z.string().min(1).max(40),
  color: z.string().min(1).max(32),
  avatarSeed: z.string().min(1).max(80),
  contextType: z.enum(['SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM']),
  contextId: z.string().uuid(),
});

const PersistedContextSchema = z.object({
  contextType: z.enum(['SERVER_CHANNEL', 'DM_THREAD', 'EPHEMERAL_ROOM']),
  contextId: z.string().min(1),
  maskId: z.string().min(1),
  actorMaskId: z.string().min(1).nullable(),
  canModerate: z.boolean(),
  canEndCall: z.boolean(),
  label: z.string().min(1).max(120),
});

const defaultDeviceState: RtcDeviceState = {
  audioInputs: [],
  audioOutputs: [],
  videoInputs: [],
  selectedAudioInputId: '',
  selectedAudioOutputId: '',
  selectedVideoInputId: '',
};

const RtcContext = createContext<RtcProviderValue | null>(null);

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

const fallbackContextLabel = (contextType: RtcContextType) => {
  switch (contextType) {
    case 'SERVER_CHANNEL':
      return 'Server Voice';
    case 'DM_THREAD':
      return 'DM Voice';
    case 'EPHEMERAL_ROOM':
      return 'Room Voice';
    default:
      return 'Voice';
  }
};

const toJoinContext = (scope: RtcJoinScope): ActiveRtcContext | null => {
  if (scope.disabled || !isContextValid(scope.contextId) || !scope.maskId) {
    return null;
  }

  return {
    contextType: scope.contextType,
    contextId: scope.contextId,
    maskId: scope.maskId,
    actorMaskId: scope.actorMaskId ?? scope.maskId,
    canModerate: Boolean(scope.canModerate),
    canEndCall: Boolean(scope.canEndCall),
    label: scope.label?.trim() || fallbackContextLabel(scope.contextType),
  };
};

const isSameContext = (a: ActiveRtcContext, b: ActiveRtcContext) => {
  return a.contextType === b.contextType && a.contextId === b.contextId;
};

const readPersistedCallContext = (): ActiveRtcContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(CALL_CONTEXT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    window.sessionStorage.removeItem(CALL_CONTEXT_STORAGE_KEY);
    return null;
  }

  const result = PersistedContextSchema.safeParse(parsed);
  if (!result.success) {
    window.sessionStorage.removeItem(CALL_CONTEXT_STORAGE_KEY);
    return null;
  }

  return result.data;
};

const persistCallContext = (context: ActiveRtcContext | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!context) {
    window.sessionStorage.removeItem(CALL_CONTEXT_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(CALL_CONTEXT_STORAGE_KEY, JSON.stringify(context));
};

export function RtcProvider({ children }: { children: ReactNode }) {
  const roomRef = useRef<LiveRoom | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const hasTriedSessionRestoreRef = useRef(false);

  const [activeContext, setActiveContext] = useState<ActiveRtcContext | null>(null);
  const [pendingSwitchContext, setPendingSwitchContext] = useState<ActiveRtcContext | null>(null);

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
  const [dockExpanded, setDockExpanded] = useState(false);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);

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
    if (typeof navigator === 'undefined') {
      return;
    }

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
    async (notifyApi: boolean, options?: { clearContext?: boolean }) => {
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

      if (options?.clearContext) {
        setActiveContext(null);
      }

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

  const joinWithContext = useCallback(
    async (target: ActiveRtcContext) => {
      setError(null);
      setPendingSwitchContext(null);

      const hasSession = Boolean(sessionIdRef.current || roomRef.current);
      if (hasSession) {
        await leaveCurrentSession(true);
      }

      setActiveContext(target);
      setConnectionState('connecting');

      try {
        const response = await createRtcSession({
          contextType: target.contextType,
          contextId: target.contextId,
          maskId: target.maskId,
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
          (participant) => participant.maskId === target.maskId && participant.isServerMuted,
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
        setError(null);
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
    },
    [applyStoredDevicePreferences, bumpRender, cleanupRoom, leaveCurrentSession],
  );

  useEffect(() => {
    return () => {
      void leaveCurrentSession(true, { clearContext: true });
    };
  }, [leaveCurrentSession]);

  useEffect(() => {
    if (hasTriedSessionRestoreRef.current) {
      return;
    }

    hasTriedSessionRestoreRef.current = true;
    const persisted = readPersistedCallContext();
    if (!persisted) {
      return;
    }

    void joinWithContext(persisted);
  }, [joinWithContext]);

  useEffect(() => {
    persistCallContext(activeContext);
  }, [activeContext]);

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

  const selfServerMuted = Boolean(activeContext?.maskId && mutedMaskIds.has(activeContext.maskId));

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

  const requestJoin = useCallback(
    async (scope: RtcJoinScope) => {
      const target = toJoinContext(scope);
      if (!target) {
        setError(scope.disabledReason ?? 'Select an active mask to join call.');
        return;
      }

      const hasLiveSession =
        Boolean(sessionIdRef.current) ||
        connectionState === 'connecting' ||
        connectionState === 'connected' ||
        connectionState === 'reconnecting';
      const sameContext = Boolean(activeContext && isSameContext(activeContext, target));

      if (hasLiveSession && activeContext && !sameContext) {
        setPendingSwitchContext(target);
        return;
      }

      if (sameContext && sessionIdRef.current) {
        setActiveContext((current) => {
          if (!current || !isSameContext(current, target)) {
            return current;
          }

          return {
            ...current,
            label: target.label,
            canModerate: target.canModerate,
            canEndCall: target.canEndCall,
          };
        });
        setError(null);
        return;
      }

      await joinWithContext(target);
    },
    [activeContext, connectionState, joinWithContext],
  );

  const confirmSwitchJoin = useCallback(async () => {
    if (!pendingSwitchContext) {
      return;
    }

    await joinWithContext(pendingSwitchContext);
  }, [joinWithContext, pendingSwitchContext]);

  const cancelSwitchJoin = useCallback(() => {
    setPendingSwitchContext(null);
  }, []);

  const leaveCall = useCallback(async () => {
    setPendingSwitchContext(null);
    await leaveCurrentSession(true, { clearContext: true });
    setConnectionState('idle');
    setError(null);
    setDockExpanded(false);
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
      if (!sessionIdRef.current || !activeContext?.actorMaskId || !activeContext.canModerate) {
        return;
      }

      try {
        const response = await muteRtcParticipant(sessionIdRef.current, {
          actorMaskId: activeContext.actorMaskId,
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
    [activeContext],
  );

  const endCall = useCallback(async () => {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId || !activeContext?.actorMaskId || !activeContext.canEndCall) {
      return;
    }

    try {
      await endRtcSession(activeSessionId, {
        actorMaskId: activeContext.actorMaskId,
      });
      await leaveCurrentSession(false, { clearContext: true });
      setConnectionState('idle');
      setError(null);
      setDockExpanded(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to end call');
      }
    }
  }, [activeContext, leaveCurrentSession]);

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

  const syncActiveContext = useCallback((scope: RtcJoinScope) => {
    const target = toJoinContext(scope);
    if (!target) {
      return;
    }

    setActiveContext((current) => {
      if (!current || !isSameContext(current, target)) {
        return current;
      }

      return {
        ...current,
        canModerate: target.canModerate,
        canEndCall: target.canEndCall,
        label: target.label,
      };
    });
  }, []);

  const value = useMemo<RtcProviderValue>(
    () => ({
      room: roomRef.current,
      activeContext,
      pendingSwitchContext,
      connectionState,
      error,
      sessionId,
      livekitRoomName,
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
      canModerate: Boolean(activeContext?.canModerate),
      canEndCall: Boolean(activeContext?.canEndCall),
      devices,
      dockExpanded,
      devicePickerOpen,
      toggleDockExpanded: () => setDockExpanded((current) => !current),
      setDockExpanded,
      openDevicePicker: () => setDevicePickerOpen(true),
      closeDevicePicker: () => setDevicePickerOpen(false),
      requestJoin,
      confirmSwitchJoin,
      cancelSwitchJoin,
      leaveCall,
      toggleMic,
      toggleCamera,
      toggleScreenShare,
      toggleDeafened,
      muteParticipant,
      endCall,
      refreshDevices,
      setPreferredDevice,
      clearError: () => setError(null),
      syncActiveContext,
    }),
    [
      activeContext,
      pendingSwitchContext,
      connectionState,
      error,
      sessionId,
      livekitRoomName,
      participantViews,
      participantsSnapshot,
      hasVisualMedia,
      activeScreenShare,
      speakingCount,
      micEnabled,
      cameraEnabled,
      screenEnabled,
      deafened,
      selfServerMuted,
      devices,
      dockExpanded,
      devicePickerOpen,
      requestJoin,
      confirmSwitchJoin,
      cancelSwitchJoin,
      leaveCall,
      toggleMic,
      toggleCamera,
      toggleScreenShare,
      toggleDeafened,
      muteParticipant,
      endCall,
      refreshDevices,
      setPreferredDevice,
      syncActiveContext,
    ],
  );

  return <RtcContext.Provider value={value}>{children}</RtcContext.Provider>;
}

export function useRtc() {
  const value = useContext(RtcContext);
  if (!value) {
    throw new Error('useRtc must be used within an RtcProvider');
  }

  return value;
}

export function useRtcScope(scope: RtcJoinScope): ScopedRtcSession {
  const rtc = useRtc();
  const syncActiveContext = rtc.syncActiveContext;

  const normalizedScope = useMemo(
    () => ({
      contextType: scope.contextType,
      contextId: scope.contextId,
      maskId: scope.maskId,
      actorMaskId: scope.actorMaskId,
      canModerate: scope.canModerate,
      canEndCall: scope.canEndCall,
      disabled: scope.disabled,
      disabledReason: scope.disabledReason,
      label: scope.label,
    }),
    [
      scope.contextType,
      scope.contextId,
      scope.maskId,
      scope.actorMaskId,
      scope.canModerate,
      scope.canEndCall,
      scope.disabled,
      scope.disabledReason,
      scope.label,
    ],
  );
  const targetContext = useMemo(() => toJoinContext(normalizedScope), [normalizedScope]);
  const canJoin = Boolean(targetContext);

  const isCurrentContext = Boolean(
    targetContext && rtc.activeContext && isSameContext(targetContext, rtc.activeContext),
  );
  const inAnotherCall = Boolean(rtc.activeContext && !isCurrentContext && rtc.sessionId);

  useEffect(() => {
    if (!isCurrentContext) {
      return;
    }

    syncActiveContext(normalizedScope);
  }, [isCurrentContext, normalizedScope, syncActiveContext]);

  return {
    room: isCurrentContext ? rtc.room : null,
    sessionId: isCurrentContext ? rtc.sessionId : null,
    livekitRoomName: isCurrentContext ? rtc.livekitRoomName : null,
    connectionState: isCurrentContext ? rtc.connectionState : 'idle',
    error: rtc.error,
    participants: isCurrentContext ? rtc.participants : [],
    participantsSnapshot: isCurrentContext ? rtc.participantsSnapshot : [],
    hasVisualMedia: isCurrentContext ? rtc.hasVisualMedia : false,
    activeScreenShare: isCurrentContext ? rtc.activeScreenShare : null,
    speakingCount: isCurrentContext ? rtc.speakingCount : 0,
    micEnabled: isCurrentContext ? rtc.micEnabled : false,
    cameraEnabled: isCurrentContext ? rtc.cameraEnabled : false,
    screenEnabled: isCurrentContext ? rtc.screenEnabled : false,
    deafened: isCurrentContext ? rtc.deafened : false,
    selfServerMuted: isCurrentContext ? rtc.selfServerMuted : false,
    canJoin,
    canModerate: isCurrentContext ? rtc.canModerate : Boolean(scope.canModerate),
    canEndCall: isCurrentContext ? rtc.canEndCall : Boolean(scope.canEndCall),
    disabled: Boolean(scope.disabled),
    activeContext: rtc.activeContext,
    isCurrentContext,
    inAnotherCall,
    joinCall: async () => rtc.requestJoin(scope),
    leaveCall: async () => {
      if (!isCurrentContext) {
        return;
      }
      await rtc.leaveCall();
    },
    toggleMic: async () => {
      if (!isCurrentContext) {
        return;
      }
      await rtc.toggleMic();
    },
    toggleCamera: async () => {
      if (!isCurrentContext) {
        return;
      }
      await rtc.toggleCamera();
    },
    toggleScreenShare: async () => {
      if (!isCurrentContext) {
        return;
      }
      await rtc.toggleScreenShare();
    },
    toggleDeafened: () => {
      if (!isCurrentContext) {
        return;
      }
      rtc.toggleDeafened();
    },
    muteParticipant: async (targetMaskId: string) => {
      if (!isCurrentContext) {
        return;
      }
      await rtc.muteParticipant(targetMaskId);
    },
    endCall: async () => {
      if (!isCurrentContext) {
        return;
      }
      await rtc.endCall();
    },
    devices: rtc.devices,
    refreshDevices: rtc.refreshDevices,
    setPreferredDevice: rtc.setPreferredDevice,
    clearError: rtc.clearError,
    openDevicePicker: rtc.openDevicePicker,
  };
}
