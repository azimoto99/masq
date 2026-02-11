import { type RefObject, useEffect, useRef } from 'react';
import type { Track } from 'livekit-client';

interface MediaTrackProps {
  track: Track | null;
  kind: 'video' | 'audio';
  muted?: boolean;
  className?: string;
}

export function MediaTrack({ track, kind, muted = false, className }: MediaTrackProps) {
  const elementRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!track || !element) {
      return;
    }

    track.attach(element);
    if (kind === 'audio') {
      const audioElement = element as HTMLAudioElement;
      audioElement.muted = muted;
      audioElement.volume = muted ? 0 : 1;
    }
    return () => {
      track.detach(element);
    };
  }, [kind, muted, track]);

  useEffect(() => {
    if (kind !== 'audio') {
      return;
    }

    const element = elementRef.current as HTMLAudioElement | null;
    if (!element) {
      return;
    }

    element.muted = muted;
    element.volume = muted ? 0 : 1;
  }, [kind, muted]);

  if (kind === 'video') {
    return (
      <video
        ref={elementRef as RefObject<HTMLVideoElement>}
        autoPlay
        playsInline
        muted={muted}
        className={className ?? 'h-full w-full object-cover'}
      />
    );
  }

  return (
    <audio
      ref={elementRef as RefObject<HTMLAudioElement>}
      autoPlay
      muted={muted}
      className={className}
    />
  );
}
