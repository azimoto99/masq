import type { AuraEventKind, AuraTier } from '@masq/shared';

interface AuraTierConfig {
  tier: AuraTier;
  minInclusive: number;
  maxExclusive: number | null;
  color: string;
  label: string;
}

export const AURA_TIER_CONFIG: AuraTierConfig[] = [
  { tier: 'DORMANT', minInclusive: 0, maxExclusive: 100, color: 'Gray', label: 'Dormant' },
  { tier: 'PRESENT', minInclusive: 100, maxExclusive: 500, color: 'Cyan', label: 'Present' },
  { tier: 'RESONANT', minInclusive: 500, maxExclusive: 1500, color: 'Blue', label: 'Resonant' },
  { tier: 'RADIANT', minInclusive: 1500, maxExclusive: 4000, color: 'Purple', label: 'Radiant' },
  { tier: 'ASCENDANT', minInclusive: 4000, maxExclusive: null, color: 'Gold', label: 'Ascendant' },
];

export const AURA_DECAY_GRACE_DAYS = 1.5;
export const AURA_DECAY_RATE_PER_DAY = 0.12;
export const AURA_DECAY_FLOOR = 0.35;
export const AURA_MESSAGE_WINDOW_MS = 10 * 60 * 1000;
export const AURA_MESSAGE_WINDOW_EVENT_CAP = 8;

export interface AuraComputedSummary {
  score: number;
  effectiveScore: number;
  tier: AuraTier;
  tierLabel: string;
  color: string;
  nextTierAt: number | null;
  percentToNext: number;
}

const clampNonNegativeInt = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

export const computeEffectiveAuraScore = (score: number, lastActivityAt: Date, now: Date = new Date()): number => {
  const lifetimeScore = clampNonNegativeInt(score);
  if (lifetimeScore === 0) {
    return 0;
  }

  const lastActivityMs = lastActivityAt.getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(lastActivityMs) || !Number.isFinite(nowMs) || nowMs <= lastActivityMs) {
    return lifetimeScore;
  }

  const inactiveMs = nowMs - lastActivityMs;
  const daysInactive = inactiveMs / (24 * 60 * 60 * 1000);
  const decayMultiplier = computeDecayMultiplier(daysInactive);
  return clampNonNegativeInt(lifetimeScore * decayMultiplier);
};

export const computeDecayMultiplier = (daysInactive: number): number => {
  if (!Number.isFinite(daysInactive) || daysInactive <= AURA_DECAY_GRACE_DAYS) {
    return 1;
  }

  const activeDecayDays = daysInactive - AURA_DECAY_GRACE_DAYS;
  const raw = AURA_DECAY_FLOOR + (1 - AURA_DECAY_FLOOR) * Math.exp(-AURA_DECAY_RATE_PER_DAY * activeDecayDays);
  if (!Number.isFinite(raw)) {
    return AURA_DECAY_FLOOR;
  }

  return Math.max(AURA_DECAY_FLOOR, Math.min(1, raw));
};

export const getAuraTierConfig = (effectiveScore: number): AuraTierConfig => {
  const normalizedScore = clampNonNegativeInt(effectiveScore);
  for (const config of AURA_TIER_CONFIG) {
    if (normalizedScore < config.minInclusive) {
      continue;
    }

    if (config.maxExclusive === null || normalizedScore < config.maxExclusive) {
      return config;
    }
  }

  return AURA_TIER_CONFIG[AURA_TIER_CONFIG.length - 1];
};

export const computeAuraSummary = (score: number, lastActivityAt: Date, now: Date = new Date()): AuraComputedSummary => {
  const normalizedScore = clampNonNegativeInt(score);
  const effectiveScore = computeEffectiveAuraScore(normalizedScore, lastActivityAt, now);
  const tierConfig = getAuraTierConfig(effectiveScore);
  const nextTierAt = tierConfig.maxExclusive;
  const tierSpan = nextTierAt === null ? null : Math.max(1, nextTierAt - tierConfig.minInclusive);
  const progressInTier = Math.max(0, effectiveScore - tierConfig.minInclusive);
  const percentToNext =
    tierSpan === null ? 100 : Math.max(0, Math.min(100, Math.round((progressInTier / tierSpan) * 100)));

  return {
    score: normalizedScore,
    effectiveScore,
    tier: tierConfig.tier,
    tierLabel: tierConfig.label,
    color: tierConfig.color,
    nextTierAt,
    percentToNext,
  };
};

const AURA_BASE_WEIGHTS: Record<AuraEventKind, number> = {
  MESSAGE_SENT: 4,
  REACTION_RECEIVED: 6,
  MENTIONED: 6,
  VOICE_MINUTES: 2,
  SESSION_HOSTED: 20,
  SESSION_JOINED: 10,
};

export const getAuraBaseWeight = (kind: AuraEventKind): number => {
  return AURA_BASE_WEIGHTS[kind] ?? 0;
};

const toAppliedWeight = (weight: number) => {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(weight));
};

export const getDailyDiminishingMultiplier = (eventsTodayForKind: number): number => {
  if (eventsTodayForKind < 8) {
    return 1;
  }

  if (eventsTodayForKind < 24) {
    return 0.6;
  }

  if (eventsTodayForKind < 60) {
    return 0.35;
  }

  if (eventsTodayForKind < 120) {
    return 0.2;
  }

  return 0.1;
};

export const applyDailyDiminishingReturns = (baseWeight: number, eventsTodayForKind: number): number => {
  const normalizedWeight = clampNonNegativeInt(baseWeight);
  if (normalizedWeight <= 0) {
    return 0;
  }

  return toAppliedWeight(normalizedWeight * getDailyDiminishingMultiplier(eventsTodayForKind));
};

export const applyUniqueActorWeighting = (weight: number, isUniqueActorForKindToday: boolean): number => {
  if (weight <= 0) {
    return 0;
  }

  return toAppliedWeight(isUniqueActorForKindToday ? weight : weight * 0.45);
};

export const applyMessageRateClamp = (
  weight: number,
  eventsInRecentWindow: number,
  maxWindowEvents: number = AURA_MESSAGE_WINDOW_EVENT_CAP,
): number => {
  if (weight <= 0) {
    return 0;
  }

  if (eventsInRecentWindow >= maxWindowEvents) {
    return 0;
  }

  return toAppliedWeight(weight);
};

export interface ComputeAuraEventWeightInput {
  kind: AuraEventKind;
  eventsTodayForKind: number;
  eventsInRecentWindow?: number;
  isUniqueActorForKindToday?: boolean;
}

export const computeAuraEventWeight = (input: ComputeAuraEventWeightInput): number => {
  let nextWeight = applyDailyDiminishingReturns(getAuraBaseWeight(input.kind), input.eventsTodayForKind);

  if (input.kind === 'REACTION_RECEIVED' || input.kind === 'MENTIONED') {
    nextWeight = applyUniqueActorWeighting(nextWeight, input.isUniqueActorForKindToday ?? true);
  }

  if (input.kind === 'MESSAGE_SENT') {
    nextWeight = applyMessageRateClamp(nextWeight, input.eventsInRecentWindow ?? 0);
  }

  return toAppliedWeight(nextWeight);
};
