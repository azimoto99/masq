import type { RtcDeviceState } from './types';

interface DevicePickerModalProps {
  open: boolean;
  devices: RtcDeviceState;
  onClose: () => void;
  onRefresh: () => void;
  onSelectDevice: (kind: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => void;
}

export function DevicePickerModal({
  open,
  devices,
  onClose,
  onRefresh,
  onSelectDevice,
}: DevicePickerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="masq-surface w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Device Settings</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ink-600 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-slate-500"
          >
            Close
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-400">
            <span className="mb-1 block uppercase tracking-[0.12em] text-slate-500">Microphone</span>
            <select
              className="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-white focus:border-cyan-300"
              value={devices.selectedAudioInputId}
              onChange={(event) => {
                onSelectDevice('audioinput', event.target.value);
              }}
            >
              {devices.audioInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            <span className="mb-1 block uppercase tracking-[0.12em] text-slate-500">Speaker Output</span>
            <select
              className="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-white focus:border-cyan-300"
              value={devices.selectedAudioOutputId}
              onChange={(event) => {
                onSelectDevice('audiooutput', event.target.value);
              }}
            >
              {devices.audioOutputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Speaker ${device.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            <span className="mb-1 block uppercase tracking-[0.12em] text-slate-500">Camera</span>
            <select
              className="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-white focus:border-cyan-300"
              value={devices.selectedVideoInputId}
              onChange={(event) => {
                onSelectDevice('videoinput', event.target.value);
              }}
            >
              {devices.videoInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300"
          >
            Refresh Devices
          </button>
        </div>
      </div>
    </div>
  );
}
