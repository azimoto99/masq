import type { RtcConnectionState } from './types';

interface CallBarProps {
  connectionState: RtcConnectionState;
  sessionId: string | null;
  canJoin: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  deafened: boolean;
  selfServerMuted: boolean;
  speakingCount: number;
  hasActiveScreenShare: boolean;
  error?: string | null;
  disabledReason?: string;
  canEndCall?: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleDeafened: () => void;
  onOpenDevices: () => void;
  onEndCall: () => void;
}

const connectionLabel = (state: RtcConnectionState) => {
  switch (state) {
    case 'connecting':
      return 'Connecting';
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting';
    case 'disconnected':
      return 'Disconnected';
    case 'idle':
    default:
      return 'Idle';
  }
};

export function CallBar({
  connectionState,
  sessionId,
  canJoin,
  micEnabled,
  cameraEnabled,
  screenEnabled,
  deafened,
  selfServerMuted,
  speakingCount,
  hasActiveScreenShare,
  error,
  disabledReason,
  canEndCall = false,
  onJoin,
  onLeave,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleDeafened,
  onOpenDevices,
  onEndCall,
}: CallBarProps) {
  const live = connectionState === 'connected' || connectionState === 'reconnecting';

  return (
    <div
      className={`rounded-lg border bg-ink-900/75 p-2 transition ${
        live ? 'border-emerald-400/40 ring-1 ring-emerald-400/20' : 'border-ink-700'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
            Call {connectionLabel(connectionState)}
          </p>
          <p className="text-[10px] text-slate-500">
            {speakingCount > 0 ? `${speakingCount} speaking` : 'No active speakers'}
            {hasActiveScreenShare ? ' - screen sharing live' : ''}
            {selfServerMuted ? ' - server muted' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {sessionId ? (
            <button
              type="button"
              onClick={onLeave}
              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-rose-100 hover:border-rose-400"
            >
              Leave
            </button>
          ) : (
            <button
              type="button"
              onClick={onJoin}
              disabled={!canJoin || connectionState === 'connecting'}
              className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connectionState === 'connecting' ? 'Joining' : 'Join'}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMic}
            disabled={!sessionId || selfServerMuted}
            className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60 ${
              micEnabled
                ? 'border-cyan-300/55 bg-cyan-300/10 text-cyan-100 hover:border-cyan-300'
                : 'border-ink-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            Mic
          </button>

          <button
            type="button"
            onClick={onToggleDeafened}
            disabled={!sessionId}
            className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60 ${
              deafened
                ? 'border-amber-400/55 bg-amber-500/10 text-amber-100 hover:border-amber-300'
                : 'border-ink-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            Deafen
          </button>

          <button
            type="button"
            onClick={onToggleCamera}
            disabled={!sessionId || selfServerMuted}
            className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60 ${
              cameraEnabled
                ? 'border-cyan-300/55 bg-cyan-300/10 text-cyan-100 hover:border-cyan-300'
                : 'border-ink-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            Camera
          </button>

          <button
            type="button"
            onClick={onToggleScreenShare}
            disabled={!sessionId || selfServerMuted}
            className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60 ${
              screenEnabled
                ? 'border-cyan-300/55 bg-cyan-300/10 text-cyan-100 hover:border-cyan-300'
                : 'border-ink-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            Share
          </button>

          <button
            type="button"
            onClick={onOpenDevices}
            disabled={!sessionId}
            className="rounded-md border border-ink-600 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Devices
          </button>

          {canEndCall && sessionId ? (
            <button
              type="button"
              onClick={onEndCall}
              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-rose-100 hover:border-rose-400"
            >
              End
            </button>
          ) : null}
        </div>
      </div>

      {disabledReason && !canJoin && !sessionId ? (
        <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
          {disabledReason}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
