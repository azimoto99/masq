import { describe, expect, it } from 'vitest';
import {
  applyDailyDiminishingReturns,
  computeAuraEventWeight,
  computeDecayMultiplier,
  computeAuraSummary,
  getAuraTierConfig,
} from '../src/domain/aura.js';

describe('aura tier mapping', () => {
  it('maps effective score to expected tier and color', () => {
    expect(getAuraTierConfig(0)).toMatchObject({ tier: 'DORMANT', color: 'Gray' });
    expect(getAuraTierConfig(120)).toMatchObject({ tier: 'PRESENT', color: 'Cyan' });
    expect(getAuraTierConfig(700)).toMatchObject({ tier: 'RESONANT', color: 'Blue' });
    expect(getAuraTierConfig(2100)).toMatchObject({ tier: 'RADIANT', color: 'Purple' });
    expect(getAuraTierConfig(9000)).toMatchObject({ tier: 'ASCENDANT', color: 'Gold' });
  });
});

describe('aura decay', () => {
  it('reduces effective score after inactivity while keeping lifetime score', () => {
    const now = new Date('2026-02-13T12:00:00.000Z');
    const activeSummary = computeAuraSummary(1600, new Date('2026-02-11T12:00:00.000Z'), now);
    const staleSummary = computeAuraSummary(1600, new Date('2025-12-15T12:00:00.000Z'), now);

    expect(activeSummary.score).toBe(1600);
    expect(activeSummary.effectiveScore).toBeLessThan(1600);
    expect(activeSummary.effectiveScore).toBeGreaterThan(1500);
    expect(staleSummary.score).toBe(1600);
    expect(staleSummary.effectiveScore).toBeLessThan(1600);
  });

  it('decay multiplier approaches floor and never goes negative', () => {
    expect(computeDecayMultiplier(0)).toBe(1);
    expect(computeDecayMultiplier(3650)).toBeGreaterThan(0.34);
    expect(computeDecayMultiplier(3650)).toBeLessThanOrEqual(1);
  });
});

describe('aura anti-farm diminishing returns', () => {
  it('clamps repeated daily events', () => {
    expect(applyDailyDiminishingReturns(8, 0)).toBe(8);
    expect(applyDailyDiminishingReturns(8, 24)).toBe(2);
    expect(applyDailyDiminishingReturns(8, 120)).toBe(1);
    expect(applyDailyDiminishingReturns(1, 120)).toBe(1);
  });

  it('weights unique actors higher than repeated actors', () => {
    const uniqueWeight = computeAuraEventWeight({
      kind: 'REACTION_RECEIVED',
      eventsTodayForKind: 0,
      isUniqueActorForKindToday: true,
    });
    const repeatedWeight = computeAuraEventWeight({
      kind: 'REACTION_RECEIVED',
      eventsTodayForKind: 0,
      isUniqueActorForKindToday: false,
    });

    expect(uniqueWeight).toBeGreaterThan(repeatedWeight);
  });

  it('clamps message aura in short spam windows', () => {
    const allowedWeight = computeAuraEventWeight({
      kind: 'MESSAGE_SENT',
      eventsTodayForKind: 0,
      eventsInRecentWindow: 2,
    });
    const clampedWeight = computeAuraEventWeight({
      kind: 'MESSAGE_SENT',
      eventsTodayForKind: 0,
      eventsInRecentWindow: 99,
    });

    expect(allowedWeight).toBeGreaterThan(0);
    expect(clampedWeight).toBe(0);
  });
});
