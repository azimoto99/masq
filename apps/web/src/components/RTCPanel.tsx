import { type RtcContextType } from '@masq/shared';
import { useState } from 'react';
import { CallBar } from './rtc/CallBar';
import { CallPanel } from './rtc/CallPanel';
import { DevicePickerModal } from './rtc/DevicePickerModal';
import { VideoStage } from './rtc/VideoStage';
import { useRtcScope } from '../rtc/RtcProvider';

interface RTCPanelProps {
  contextType: RtcContextType;
  contextId: string | null;
  maskId: string | null;
  actorMaskId?: string | null;
  canModerate?: boolean;
  canEndCall?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  contextLabel?: string;
  title?: string;
}

export function RTCPanel({
  contextType,
  contextId,
  maskId,
  actorMaskId,
  canModerate = false,
  canEndCall = false,
  disabled = false,
  disabledReason,
  contextLabel,
  title = 'Voice / Video',
}: RTCPanelProps) {
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const rtc = useRtcScope({
    contextType,
    contextId,
    maskId,
    actorMaskId,
    canModerate,
    canEndCall,
    disabled,
    disabledReason,
    label: contextLabel ?? title,
  });

  return (
    <section className="space-y-2 rounded-xl border border-ink-700 bg-ink-900/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</p>

      {rtc.inAnotherCall && rtc.activeContext ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
          Active call is running in {rtc.activeContext.label}. Joining here will prompt to switch.
        </p>
      ) : null}

      <CallBar
        connectionState={rtc.connectionState}
        sessionId={rtc.sessionId}
        canJoin={rtc.canJoin}
        micEnabled={rtc.micEnabled}
        cameraEnabled={rtc.cameraEnabled}
        screenEnabled={rtc.screenEnabled}
        deafened={rtc.deafened}
        selfServerMuted={rtc.selfServerMuted}
        speakingCount={rtc.speakingCount}
        hasActiveScreenShare={Boolean(rtc.activeScreenShare)}
        error={rtc.error}
        disabledReason={disabledReason}
        canEndCall={rtc.canEndCall}
        onJoin={() => {
          void rtc.joinCall();
        }}
        onLeave={() => {
          void rtc.leaveCall();
        }}
        onToggleMic={() => {
          void rtc.toggleMic();
        }}
        onToggleCamera={() => {
          void rtc.toggleCamera();
        }}
        onToggleScreenShare={() => {
          void rtc.toggleScreenShare();
        }}
        onToggleDeafened={rtc.toggleDeafened}
        onOpenDevices={() => {
          setDevicePickerOpen(true);
        }}
        onEndCall={() => {
          void rtc.endCall();
        }}
      />

      {rtc.hasVisualMedia ? (
        <VideoStage
          participants={rtc.participants}
          activeScreenShare={rtc.activeScreenShare}
          deafened={rtc.deafened}
          canModerate={rtc.canModerate}
          localMaskId={rtc.activeContext?.maskId ?? maskId}
          onMuteParticipant={(maskIdValue) => {
            void rtc.muteParticipant(maskIdValue);
          }}
        />
      ) : null}

      <CallPanel
        connectionState={rtc.connectionState}
        sessionId={rtc.sessionId}
        roomName={rtc.livekitRoomName}
        participants={rtc.participants}
        canJoin={rtc.canJoin}
        canModerate={rtc.canModerate}
        onJoin={() => {
          void rtc.joinCall();
        }}
        onLeave={() => {
          void rtc.leaveCall();
        }}
        onMuteParticipant={(maskIdValue) => {
          void rtc.muteParticipant(maskIdValue);
        }}
      />

      <DevicePickerModal
        open={devicePickerOpen}
        devices={rtc.devices}
        onClose={() => {
          setDevicePickerOpen(false);
        }}
        onRefresh={() => {
          void rtc.refreshDevices();
        }}
        onSelectDevice={(kind, deviceId) => {
          void rtc.setPreferredDevice(kind, deviceId);
        }}
      />
    </section>
  );
}
