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
    return () => {
      track.detach(element);
    };
  }, [track]);

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

  return <audio ref={elementRef as RefObject<HTMLAudioElement>} autoPlay muted={muted} className={className} />;
}
