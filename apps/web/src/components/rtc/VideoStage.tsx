import { useEffect, useMemo, useState } from 'react';
import { MediaTrack } from './MediaTrack';
import type { RtcParticipantView } from './types';

interface VideoStageProps {
  participants: RtcParticipantView[];
  activeScreenShare: RtcParticipantView | null;
  deafened: boolean;
  canModerate: boolean;
  localMaskId?: string | null;
  onMuteParticipant: (maskId: string) => void;
}

type TileMode = 'camera' | 'screen' | 'none';

interface LabeledParticipant {
  participant: RtcParticipantView;
  displayName: string;
}

const getTileMode = (participant: RtcParticipantView): TileMode => {
  if (participant.screenTrack) {
    return 'screen';
  }

  if (participant.cameraTrack) {
    return 'camera';
  }

  return 'none';
};

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

const toCameraFocusKey = (identity: string) => `camera:${identity}`;
const toScreenFocusKey = (identity: string) => `screen:${identity}`;

const SpeakerTile = ({
  entry,
  focusKey,
  deafened,
  canModerate,
  localMaskId,
  localIdentity,
  onMuteParticipant,
  onToggleFocus,
}: {
  entry: LabeledParticipant;
  focusKey: string | null;
  deafened: boolean;
  canModerate: boolean;
  localMaskId: string | null | undefined;
  localIdentity: string | null;
  onMuteParticipant: (maskId: string) => void;
  onToggleFocus: (nextFocusKey: string | null) => void;
}) => {
  const { participant, displayName } = entry;
  const mask = participant.metadata;
  const color = mask?.color ?? '#78e6da';
  const maskId = mask?.maskId ?? '';
  const isSelf = isSelfParticipant(participant, localIdentity, localMaskId);
  const tileMode = getTileMode(participant);
  const tileFocusKey =
    tileMode === 'camera'
      ? toCameraFocusKey(participant.identity)
      : tileMode === 'screen'
        ? toScreenFocusKey(participant.identity)
        : null;
  const isFocused = Boolean(tileFocusKey && focusKey === tileFocusKey);

  return (
    <article className="rounded-lg border border-ink-700 bg-ink-900/80 p-1.5">
      <div
        className={`relative overflow-hidden rounded-md border border-ink-700 bg-ink-800 ${
          tileMode === 'screen' ? 'aspect-video' : 'aspect-[4/3]'
        }`}
      >
        {participant.screenTrack ? (
          <MediaTrack track={participant.screenTrack} kind="video" muted={isSelf || deafened} />
        ) : participant.cameraTrack ? (
          <MediaTrack track={participant.cameraTrack} kind="video" muted={isSelf || deafened} />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-[0.12em] text-slate-500">
            Voice only
          </div>
        )}

        {participant.audioTrack && !isSelf ? (
          <MediaTrack track={participant.audioTrack} kind="audio" muted={deafened} />
        ) : null}

        <div className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.11em] text-white">
          {participant.isSpeaking ? 'Speaking' : 'Idle'}
        </div>

        {tileFocusKey ? (
          <button
            type="button"
            onClick={() => onToggleFocus(tileFocusKey)}
            className={`absolute right-1.5 top-1.5 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.11em] transition ${
              isFocused
                ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100'
                : 'border-white/20 bg-black/65 text-slate-200 hover:border-cyan-300/60 hover:text-white'
            }`}
          >
            {isFocused ? 'Restore' : 'Maximize'}
          </button>
        ) : null}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <p className="truncate text-xs font-medium text-slate-100">{displayName}</p>
        </div>

        {participant.isServerMuted ? <span className="text-[10px] text-amber-200">Muted</span> : null}
      </div>

      {canModerate && !isSelf && maskId ? (
        <button
          type="button"
          className="mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-100 hover:border-amber-400"
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
  localMaskId,
  onMuteParticipant,
}: VideoStageProps) {
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const labeledParticipants = useMemo<LabeledParticipant[]>(
    () =>
      participants.map((participant, index) => ({
        participant,
        displayName: participant.metadata?.displayName ?? (participant.isLocal ? 'You' : `Participant ${index + 1}`),
      })),
    [participants],
  );

  const activeScreenIdentity = activeScreenShare?.identity ?? null;
  const localIdentity = useMemo(
    () => labeledParticipants.find((entry) => entry.participant.isLocal)?.participant.identity ?? null,
    [labeledParticipants],
  );

  const focusedMedia = useMemo(() => {
    if (!focusKey) {
      return null;
    }

    const separatorIndex = focusKey.indexOf(':');
    if (separatorIndex <= 0) {
      return null;
    }

    const kind = focusKey.slice(0, separatorIndex);
    const identity = focusKey.slice(separatorIndex + 1);
    if (!identity || (kind !== 'camera' && kind !== 'screen')) {
      return null;
    }

    const matched = labeledParticipants.find((entry) => entry.participant.identity === identity);
    if (!matched) {
      return null;
    }

    if (kind === 'camera' && !matched.participant.cameraTrack) {
      return null;
    }

    if (kind === 'screen' && !matched.participant.screenTrack) {
      return null;
    }

    return {
      kind: kind as 'camera' | 'screen',
      entry: matched,
    };
  }, [focusKey, labeledParticipants]);

  useEffect(() => {
    if (focusKey && !focusedMedia) {
      setFocusKey(null);
    }
  }, [focusKey, focusedMedia]);

  const onToggleFocus = (nextFocusKey: string | null) => {
    setFocusKey((current) => (current === nextFocusKey ? null : nextFocusKey));
  };

  const focusedParticipant = focusedMedia?.entry.participant ?? null;
  const focusedDisplayName = focusedMedia?.entry.displayName ?? null;
  const focusedColor = focusedParticipant?.metadata?.color ?? '#78e6da';
  const focusedParticipantIsSelf = focusedParticipant
    ? isSelfParticipant(focusedParticipant, localIdentity, localMaskId)
    : false;

  const sideParticipants = labeledParticipants.filter((entry) => {
    if (!activeScreenIdentity) {
      return true;
    }

    return entry.participant.identity !== activeScreenIdentity;
  });

  const screenShareEntry = activeScreenIdentity
    ? labeledParticipants.find((entry) => entry.participant.identity === activeScreenIdentity) ?? null
    : null;
  const activeScreenFocusKey = activeScreenIdentity ? toScreenFocusKey(activeScreenIdentity) : null;
  const activeScreenShareIsSelf = activeScreenShare
    ? isSelfParticipant(activeScreenShare, localIdentity, localMaskId)
    : false;

  if (participants.length === 0) {
    return null;
  }

  if (activeScreenShare) {
      return (
      <section className="space-y-1.5">
        {focusedMedia && focusedParticipant ? (
          <div className="rounded-lg border border-cyan-400/35 bg-ink-900/80 p-1.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: focusedColor }} />
                <p className="text-xs font-medium text-cyan-100">
                  {focusedDisplayName} {focusedMedia.kind === 'screen' ? '- screen share' : '- camera'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFocusKey(null)}
                className="rounded-md border border-cyan-400/45 bg-cyan-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300"
              >
                Exit Maximize
              </button>
            </div>
            <div
              className={`relative overflow-hidden rounded-lg border border-ink-700 bg-ink-800 ${
                focusedMedia.kind === 'screen' ? 'aspect-video' : 'aspect-[4/3]'
              }`}
            >
              <MediaTrack
                track={focusedMedia.kind === 'screen' ? focusedParticipant.screenTrack : focusedParticipant.cameraTrack}
                kind="video"
                muted={focusedParticipantIsSelf || deafened}
              />
              {focusedParticipant.audioTrack && !focusedParticipantIsSelf ? (
                <MediaTrack
                  track={focusedParticipant.audioTrack}
                  kind="audio"
                  muted={deafened}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-1.5 rounded-lg border border-ink-700 bg-ink-800/75 p-1.5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-lg border border-ink-700 bg-ink-900/80 p-1.5">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-200">Screen Share</p>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.11em] text-cyan-100">
                  Live
                </span>
                {activeScreenFocusKey ? (
                  <button
                    type="button"
                    onClick={() => onToggleFocus(activeScreenFocusKey)}
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.11em] transition ${
                      focusKey === activeScreenFocusKey
                        ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100'
                        : 'border-ink-600 bg-ink-900 text-slate-200 hover:border-cyan-300/60 hover:text-white'
                    }`}
                  >
                    {focusKey === activeScreenFocusKey ? 'Restore' : 'Maximize'}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-lg border border-ink-700 bg-ink-800">
              {activeScreenShare.screenTrack ? (
                <MediaTrack
                  track={activeScreenShare.screenTrack}
                  kind="video"
                  muted={activeScreenShareIsSelf || deafened}
                />
              ) : null}
              {activeScreenShare.audioTrack && !activeScreenShareIsSelf ? (
                <MediaTrack
                  track={activeScreenShare.audioTrack}
                  kind="audio"
                  muted={deafened}
                />
              ) : null}
              <div className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.11em] text-white">
                {screenShareEntry?.displayName ?? 'Screen Share'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {sideParticipants.length === 0 ? (
              <p className="rounded-md border border-ink-700 bg-ink-900/80 px-2 py-1.5 text-xs text-slate-500">
                No other participants.
              </p>
            ) : (
              sideParticipants.map((entry) => (
                <SpeakerTile
                  key={entry.participant.identity}
                  entry={entry}
                  focusKey={focusKey}
                  deafened={deafened}
                  canModerate={canModerate}
                  localMaskId={localMaskId}
                  localIdentity={localIdentity}
                  onMuteParticipant={onMuteParticipant}
                  onToggleFocus={onToggleFocus}
                />
              ))
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-1.5">
      {focusedMedia && focusedParticipant ? (
        <div className="rounded-lg border border-cyan-400/35 bg-ink-900/80 p-1.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: focusedColor }} />
              <p className="text-xs font-medium text-cyan-100">
                {focusedDisplayName} {focusedMedia.kind === 'screen' ? '- screen share' : '- camera'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFocusKey(null)}
              className="rounded-md border border-cyan-400/45 bg-cyan-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300"
            >
              Exit Maximize
            </button>
          </div>
          <div
            className={`relative overflow-hidden rounded-lg border border-ink-700 bg-ink-800 ${
              focusedMedia.kind === 'screen' ? 'aspect-video' : 'aspect-[4/3]'
            }`}
          >
            <MediaTrack
              track={focusedMedia.kind === 'screen' ? focusedParticipant.screenTrack : focusedParticipant.cameraTrack}
              kind="video"
              muted={focusedParticipantIsSelf || deafened}
            />
            {focusedParticipant.audioTrack && !focusedParticipantIsSelf ? (
              <MediaTrack
                track={focusedParticipant.audioTrack}
                kind="audio"
                muted={deafened}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="grid gap-1.5 rounded-lg border border-ink-700 bg-ink-800/75 p-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {labeledParticipants.map((entry) => (
          <SpeakerTile
            key={entry.participant.identity}
            entry={entry}
            focusKey={focusKey}
            deafened={deafened}
            canModerate={canModerate}
            localMaskId={localMaskId}
            localIdentity={localIdentity}
            onMuteParticipant={onMuteParticipant}
            onToggleFocus={onToggleFocus}
          />
        ))}
      </section>
    </section>
  );
}
