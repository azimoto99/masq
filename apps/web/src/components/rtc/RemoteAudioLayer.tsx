import { useMemo } from 'react';
import { MediaTrack } from './MediaTrack';
import type { RtcParticipantView } from './types';

interface RemoteAudioLayerProps {
  participants: RtcParticipantView[];
  deafened: boolean;
  localMaskId?: string | null;
}

const isSelfParticipant = (
  participant: RtcParticipantView,
  localIdentity: string | null,
  localMaskId: string | null | undefined,
) => {
  if (participant.isLocal) {
    return true;
  }

  if (localIdentity && participant.identity === localIdentity) {
    return true;
  }

  if (localMaskId && participant.metadata?.maskId === localMaskId) {
    return true;
  }

  return false;
};

export function RemoteAudioLayer({ participants, deafened, localMaskId }: RemoteAudioLayerProps) {
  const localIdentity = useMemo(
    () => participants.find((participant) => participant.isLocal)?.identity ?? null,
    [participants],
  );

  const remoteAudioParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.audioTrack !== null &&
          !isSelfParticipant(participant, localIdentity, localMaskId),
      ),
    [localIdentity, localMaskId, participants],
  );

  if (remoteAudioParticipants.length === 0) {
    return null;
  }

  return (
    <div className="hidden" aria-hidden="true">
      {remoteAudioParticipants.map((participant) => (
        <MediaTrack
          key={`${participant.identity}-audio`}
          track={participant.audioTrack}
          kind="audio"
          muted={deafened}
        />
      ))}
    </div>
  );
}
