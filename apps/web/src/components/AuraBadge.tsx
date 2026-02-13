import type { AuraSummary, SocketAuraSummary } from '@masq/shared';

type AuraLike = AuraSummary | SocketAuraSummary;

interface AuraBadgeProps {
  aura?: AuraLike | null;
  showLabel?: boolean;
  className?: string;
}

const labelByTier: Record<string, string> = {
  DORMANT: 'Dormant',
  PRESENT: 'Present',
  RESONANT: 'Resonant',
  RADIANT: 'Radiant',
  ASCENDANT: 'Ascendant',
};

export function AuraBadge({ aura, showLabel = false, className }: AuraBadgeProps) {
  if (!aura) {
    return null;
  }

  const label = labelByTier[aura.tier] ?? aura.tier;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`} title={`Aura ${label}`}>
      <span
        className="inline-flex h-2.5 w-2.5 rounded-full border border-white/40"
        style={{
          backgroundColor: aura.color,
          boxShadow: `0 0 0 2px ${aura.color}33`,
        }}
      />
      {showLabel ? (
        <span className="text-[10px] uppercase tracking-[0.11em] text-slate-500">{label}</span>
      ) : null}
    </span>
  );
}
