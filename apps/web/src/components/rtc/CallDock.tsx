import { useMemo } from 'react';
import { useRtc } from '../../rtc/RtcProvider';
import { CallPanel } from './CallPanel';
import { DevicePickerModal } from './DevicePickerModal';
import { VideoStage } from './VideoStage';

const connectionLabel = (state: string) => {
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

export function CallDock() {
  const rtc = useRtc();
  const hasContext = Boolean(rtc.activeContext);
  const hasSession = Boolean(rtc.sessionId);
  const hasLiveConnection = rtc.connectionState === 'connected' || rtc.connectionState === 'reconnecting';

  const localParticipant = useMemo(
    () => rtc.participants.find((participant) => participant.isLocal) ?? null,
    [rtc.participants],
  );
  const localSpeaking = Boolean(localParticipant?.isSpeaking);

  return (
    <>
      {rtc.dockExpanded && hasContext ? (
        <section className="fixed bottom-20 left-3 right-3 z-40 max-h-[70vh] overflow-hidden rounded-xl border border-ink-700 bg-ink-900/96 shadow-2xl shadow-black/45 md:left-auto md:w-[560px]">
          <header className="flex items-center justify-between gap-2 border-b border-ink-700 px-3 py-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Call Stage</p>
              <p className="truncate text-sm font-medium text-white">{rtc.activeContext?.label}</p>
            </div>
            <button
              type="button"
              onClick={rtc.toggleDockExpanded}
              className="rounded-md border border-ink-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Minimize
            </button>
          </header>
          <div className="max-h-[calc(70vh-3.25rem)] space-y-3 overflow-y-auto p-3">
            {rtc.hasVisualMedia ? (
              <VideoStage
                participants={rtc.participants}
                activeScreenShare={rtc.activeScreenShare}
                deafened={rtc.deafened}
                canModerate={rtc.canModerate}
                onMuteParticipant={(targetMaskId) => {
                  void rtc.muteParticipant(targetMaskId);
                }}
              />
            ) : null}

            <CallPanel
              connectionState={rtc.connectionState}
              sessionId={rtc.sessionId}
              roomName={rtc.livekitRoomName}
              participants={rtc.participants}
              canJoin={hasContext}
              canModerate={rtc.canModerate}
              onJoin={() => {
                if (!rtc.activeContext) {
                  return;
                }

                void rtc.requestJoin({
                  ...rtc.activeContext,
                });
              }}
              onLeave={() => {
                void rtc.leaveCall();
              }}
              onMuteParticipant={(targetMaskId) => {
                void rtc.muteParticipant(targetMaskId);
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="fixed bottom-3 left-3 right-3 z-40 sm:left-6 sm:right-6">
        <div
          className={`rounded-xl border bg-ink-900/96 px-3 py-2 shadow-xl shadow-black/45 transition ${
            hasLiveConnection
              ? 'border-emerald-400/45 ring-1 ring-emerald-400/20'
              : hasContext
                ? 'border-cyan-400/40'
                : 'border-ink-700'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300">
                {hasContext ? `In call: ${rtc.activeContext?.label}` : 'No active call'}
              </p>
              <p className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>{connectionLabel(rtc.connectionState)}</span>
                {hasContext ? (
                  <>
                    <span>{rtc.participants.length} online</span>
                    {localSpeaking ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-emerald-200">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                        Speaking
                      </span>
                    ) : null}
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {hasContext && !hasSession ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!rtc.activeContext) {
                      return;
                    }

                    void rtc.requestJoin({
                      ...rtc.activeContext,
                    });
                  }}
                  className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200 hover:border-cyan-300"
                >
                  Join
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  void rtc.toggleMic();
                }}
                disabled={!hasSession || rtc.selfServerMuted}
                className={`rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45 ${
                  rtc.micEnabled
                    ? 'border-cyan-300/55 bg-cyan-400/10 text-cyan-100'
                    : 'border-ink-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                Mic
              </button>
              <button
                type="button"
                onClick={() => {
                  void rtc.toggleCamera();
                }}
                disabled={!hasSession || rtc.selfServerMuted}
                className={`rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45 ${
                  rtc.cameraEnabled
                    ? 'border-cyan-300/55 bg-cyan-400/10 text-cyan-100'
                    : 'border-ink-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                Cam
              </button>
              <button
                type="button"
                onClick={() => {
                  void rtc.toggleScreenShare();
                }}
                disabled={!hasSession || rtc.selfServerMuted}
                className={`rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45 ${
                  rtc.screenEnabled
                    ? 'border-cyan-300/55 bg-cyan-400/10 text-cyan-100'
                    : 'border-ink-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                Share
              </button>
              <button
                type="button"
                onClick={rtc.openDevicePicker}
                disabled={!hasContext}
                className="rounded-md border border-ink-600 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Devices
              </button>
              <button
                type="button"
                onClick={rtc.toggleDockExpanded}
                disabled={!hasContext}
                className="rounded-md border border-ink-600 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {rtc.dockExpanded ? 'Collapse' : 'Expand'}
              </button>
              {hasContext ? (
                <button
                  type="button"
                  onClick={() => {
                    void rtc.leaveCall();
                  }}
                  className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-rose-200 hover:border-rose-400"
                >
                  Leave
                </button>
              ) : null}
            </div>
          </div>
          {rtc.error ? (
            <p className="mt-2 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
              {rtc.error}
            </p>
          ) : null}
        </div>
      </section>

      <DevicePickerModal
        open={rtc.devicePickerOpen}
        devices={rtc.devices}
        onClose={rtc.closeDevicePicker}
        onRefresh={() => {
          void rtc.refreshDevices();
        }}
        onSelectDevice={(kind, deviceId) => {
          void rtc.setPreferredDevice(kind, deviceId);
        }}
      />

      {rtc.pendingSwitchContext ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-900 p-4">
            <h3 className="text-sm font-semibold text-white">Switch call?</h3>
            <p className="mt-2 text-sm text-slate-300">
              You are currently connected to{' '}
              <span className="font-medium text-white">{rtc.activeContext?.label ?? 'an active call'}</span>.
            </p>
            <p className="text-sm text-slate-400">
              Leave it and join{' '}
              <span className="font-medium text-white">{rtc.pendingSwitchContext.label}</span>?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={rtc.cancelSwitchJoin}
                className="rounded-md border border-ink-600 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void rtc.confirmSwitchJoin();
                }}
                className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-rose-100 hover:border-rose-400"
              >
                Switch Call
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
