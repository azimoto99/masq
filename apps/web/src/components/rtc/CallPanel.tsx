import type { RtcConnectionState, RtcParticipantView } from './types';

interface CallPanelProps {
  connectionState: RtcConnectionState;
  sessionId: string | null;
  roomName: string | null;
  participants: RtcParticipantView[];
  canJoin: boolean;
  canModerate: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onMuteParticipant: (maskId: string) => void;
}

const statusText = (state: RtcConnectionState) => {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'disconnected':
      return 'Disconnected';
    case 'idle':
    default:
      return 'Idle';
  }
};

export function CallPanel({
  connectionState,
  sessionId,
  roomName,
  participants,
  canJoin,
  canModerate,
  onJoin,
  onLeave,
  onMuteParticipant,
}: CallPanelProps) {
  const roomStateText = roomName ? 'Private room active' : '';

  if (!sessionId) {
    return (
      <div className="rounded-lg border border-ink-700 bg-ink-900/75 p-2.5">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Call</p>
        <p className="mt-1 text-xs text-slate-400">No one is in this channel call yet.</p>
        <button
          type="button"
          onClick={onJoin}
          disabled={!canJoin}
          className="mt-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Join Voice
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/75 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Call</p>
          <p className="text-[10px] text-slate-500">
            {statusText(connectionState)}
            {roomStateText ? ` - ${roomStateText}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-rose-100 hover:border-rose-400"
        >
          Leave
        </button>
      </div>

      <div className="mt-2 space-y-1.5">
        {participants.length === 0 ? (
          <p className="text-[11px] text-slate-500">No active participants.</p>
        ) : (
          participants.map((participant, index) => {
            const mask = participant.metadata;
            const maskId = mask?.maskId ?? '';
            const displayName = mask?.displayName ?? (participant.isLocal ? 'You' : `Participant ${index + 1}`);
            const color = mask?.color ?? '#78e6da';
            const auraColor = mask?.auraColor;

            return (
              <article key={participant.identity} className="rounded-md border border-ink-700 bg-ink-800/80 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-white/30"
                      style={{
                        backgroundColor: auraColor ?? color,
                        boxShadow: auraColor ? `0 0 0 2px ${auraColor}33` : undefined,
                      }}
                    />
                    <div>
                      <p className="text-[11px] font-medium text-slate-100">{displayName}</p>
                      <p className="text-[10px] uppercase tracking-[0.11em] text-slate-500">
                        {participant.isSpeaking ? 'Speaking' : 'Listening'}
                        {' - '}
                        {participant.cameraTrack ? 'Cam' : 'No Cam'}
                        {' - '}
                        {participant.screenTrack ? 'Sharing' : 'No Share'}
                      </p>
                    </div>
                  </div>

                  {participant.isServerMuted ? <span className="text-[10px] text-amber-200">Muted</span> : null}
                </div>

                {canModerate && !participant.isLocal && maskId ? (
                  <button
                    type="button"
                    onClick={() => {
                      onMuteParticipant(maskId);
                    }}
                    className="mt-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-100 hover:border-amber-400"
                  >
                    Server Mute
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

