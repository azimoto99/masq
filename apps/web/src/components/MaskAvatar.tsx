import { useMemo, useState } from 'react';
import { buildUploadUrl } from '../lib/api';

interface MaskAvatarProps {
  displayName: string;
  color: string;
  avatarUploadId?: string | null;
  auraColor?: string | null;
  sizeClassName?: string;
  textClassName?: string;
}

const toInitials = (displayName: string): string => {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return '?';
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
};

export function MaskAvatar({
  displayName,
  color,
  avatarUploadId,
  auraColor,
  sizeClassName = 'h-8 w-8',
  textClassName = 'text-[10px]',
}: MaskAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = useMemo(() => toInitials(displayName), [displayName]);
  const imageUrl = !imageError && avatarUploadId ? buildUploadUrl(avatarUploadId) : null;

  return (
    <div
      className={`${sizeClassName} flex shrink-0 items-center justify-center overflow-hidden rounded-full border`}
      style={{
        backgroundColor: color,
        borderColor: auraColor ? `${auraColor}cc` : 'rgba(255,255,255,0.2)',
        boxShadow: auraColor ? `0 0 0 2px ${auraColor}33` : undefined,
      }}
      aria-label={`${displayName} avatar`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${displayName} avatar`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => {
            setImageError(true);
          }}
        />
      ) : (
        <span className={`font-semibold uppercase tracking-[0.08em] text-white ${textClassName}`}>
          {initials}
        </span>
      )}
    </div>
  );
}
