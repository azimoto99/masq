import { type Participant, type Track } from 'livekit-client';

export type RtcConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface RtcMaskMetadata {
  userId: string;
  maskId: string;
  displayName: string;
  color: string;
  avatarSeed: string;
  auraTier?: 'DORMANT' | 'PRESENT' | 'RESONANT' | 'RADIANT' | 'ASCENDANT';
  auraColor?: string;
}

export interface RtcParticipantView {
  participant: Participant;
  identity: string;
  isLocal: boolean;
  isSpeaking: boolean;
  metadata: RtcMaskMetadata | null;
  audioTrack: Track | null;
  cameraTrack: Track | null;
  screenTrack: Track | null;
  isServerMuted: boolean;
}

export interface RtcDeviceState {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedAudioOutputId: string;
  selectedVideoInputId: string;
}
