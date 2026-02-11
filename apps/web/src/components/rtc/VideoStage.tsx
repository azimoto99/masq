import { MediaTrack } from './MediaTrack';
import type { RtcParticipantView } from './types';

interface VideoStageProps {
  participants: RtcParticipantView[];
  activeScreenShare: RtcParticipantView | null;
  deafened: boolean;
  canModerate: boolean;
  onMuteParticipant: (maskId: string) => void;
}

const SpeakerTile = ({
  participant,
  deafened,
  canModerate,
  onMuteParticipant,
}: {
  participant: RtcParticipantView;
  deafened: boolean;
  canModerate: boolean;
  onMuteParticipant: (maskId: string) => void;
}) => {
  const mask = participant.metadata;
  const displayName = mask?.displayName ?? (participant.isLocal ? 'You' : participant.identity);
  const color = mask?.color ?? '#78e6da';
  const maskId = mask?.maskId ?? '';

  return (
    <article className="rounded-xl border border-ink-700 bg-ink-900/80 p-2">
      <div className="relative h-28 overflow-hidden rounded-md border border-ink-700 bg-ink-800">
        {participant.screenTrack ? (
          <MediaTrack track={participant.screenTrack} kind="video" muted={participant.isLocal || deafened} />
        ) : participant.cameraTrack ? (
          <MediaTrack track={participant.cameraTrack} kind="video" muted={participant.isLocal || deafened} />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-[0.12em] text-slate-500">
            Voice only
          </div>
        )}

        {participant.audioTrack ? (
          <MediaTrack track={participant.audioTrack} kind="audio" muted={participant.isLocal || deafened} />
        ) : null}

        <div className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.11em] text-white">
          {participant.isSpeaking ? 'Speaking' : 'Idle'}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <p className="truncate text-xs font-medium text-slate-100">{displayName}</p>
        </div>

        {participant.isServerMuted ? <span className="text-[10px] text-amber-200">Muted</span> : null}
      </div>

      {canModerate && !participant.isLocal && maskId ? (
        <button
          type="button"
          className="mt-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-200 hover:border-amber-400"
          onClick={() => {
            onMuteParticipant(maskId);
          }}
        >
          Server Mute
        </button>
      ) : null}
    </article>
  );
};

export function VideoStage({
  participants,
  activeScreenShare,
  deafened,
  canModerate,
  onMuteParticipant,
}: VideoStageProps) {
  if (participants.length === 0) {
    return null;
  }

  if (activeScreenShare) {
    const sideParticipants = participants.filter((item) => item.identity !== activeScreenShare.identity);

    return (
      <section className="grid gap-2 rounded-xl border border-ink-700 bg-ink-800/70 p-2 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-xl border border-ink-700 bg-ink-900/80 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-200">Screen Share</p>
            <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.11em] text-cyan-100">
              Live
            </span>
          </div>
          <div className="relative h-[260px] overflow-hidden rounded-lg border border-ink-700 bg-ink-800">
            {activeScreenShare.screenTrack ? (
              <MediaTrack
                track={activeScreenShare.screenTrack}
                kind="video"
                muted={activeScreenShare.isLocal || deafened}
              />
            ) : null}
            {activeScreenShare.audioTrack ? (
              <MediaTrack
                track={activeScreenShare.audioTrack}
                kind="audio"
                muted={activeScreenShare.isLocal || deafened}
              />
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          {sideParticipants.length === 0 ? (
            <p className="rounded-md border border-ink-700 bg-ink-900/80 px-2 py-1.5 text-xs text-slate-500">
              No other participants.
            </p>
          ) : (
            sideParticipants.map((participant) => (
              <SpeakerTile
                key={participant.identity}
                participant={participant}
                deafened={deafened}
                canModerate={canModerate}
                onMuteParticipant={onMuteParticipant}
              />
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-2 rounded-xl border border-ink-700 bg-ink-800/70 p-2 sm:grid-cols-2 xl:grid-cols-3">
      {participants.map((participant) => (
        <SpeakerTile
          key={participant.identity}
          participant={participant}
          deafened={deafened}
          canModerate={canModerate}
          onMuteParticipant={onMuteParticipant}
        />
      ))}
    </section>
  );
}
