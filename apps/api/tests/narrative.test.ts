import { describe, expect, it, vi } from 'vitest';
import {
  advanceNarrativePhase,
  assignNarrativeRoles,
  buildNarrativeStartEmissionPlan,
  canActorAdvanceNarrative,
  getNarrativePhaseTransition,
  shouldAutoAdvanceNarrativePhase,
} from '../src/domain/narrative.js';

describe('narrative role assignment', () => {
  it('assigns roles using configured counts', () => {
    const assignments = assignNarrativeRoles(
      ['mask-1', 'mask-2', 'mask-3', 'mask-4'],
      [
        { key: 'seer', name: 'Seer', description: 'Knows clues', count: 1 },
        { key: 'villager', name: 'Villager', description: 'Team member', count: 3 },
      ],
      () => 0.5,
    );

    expect(assignments).toHaveLength(4);
    const roleCounts = assignments.reduce<Record<string, number>>((acc, assignment) => {
      acc[assignment.role.key] = (acc[assignment.role.key] ?? 0) + 1;
      return acc;
    }, {});

    expect(roleCounts.seer).toBe(1);
    expect(roleCounts.villager).toBe(3);

    const transition = getNarrativePhaseTransition(
      [{ key: 'intro', label: 'Intro', durationSec: 60, allowChat: true, allowVoice: true }],
      0,
      new Date('2026-02-13T10:00:00.000Z'),
    );
    expect(transition).not.toBeNull();

    const emissionPlan = buildNarrativeStartEmissionPlan('room-1', transition!, assignments);
    expect(emissionPlan.phaseChanged.roomId).toBe('room-1');
    expect(emissionPlan.roleAssigned).toHaveLength(assignments.length);
  });
});

describe('narrative phase advancement', () => {
  it('advances by timer ticks when phase end is reached', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-13T10:00:00.000Z'));

    const phases = [
      { key: 'intro', label: 'Intro', durationSec: 10, allowChat: true, allowVoice: true },
      { key: 'reveal', label: 'Reveal', durationSec: 20, allowChat: true, allowVoice: false },
    ];

    const phase0 = getNarrativePhaseTransition(phases, 0, new Date());
    expect(phase0).not.toBeNull();
    expect(shouldAutoAdvanceNarrativePhase('RUNNING', phase0?.phaseEndsAt ?? null, new Date())).toBe(false);

    vi.advanceTimersByTime(11_000);
    expect(shouldAutoAdvanceNarrativePhase('RUNNING', phase0?.phaseEndsAt ?? null, new Date())).toBe(true);

    const phase1 = advanceNarrativePhase(phases, phase0?.phaseIndex ?? 0, new Date());
    expect(phase1?.phaseIndex).toBe(1);
    expect(phase1?.phase.key).toBe('reveal');

    vi.useRealTimers();
  });
});

describe('narrative host authorization', () => {
  it('restricts manual phase advance to host while running', () => {
    expect(canActorAdvanceNarrative('RUNNING', 'host-mask', 'host-mask')).toBe(true);
    expect(canActorAdvanceNarrative('RUNNING', 'member-mask', 'host-mask')).toBe(false);
    expect(canActorAdvanceNarrative('LOBBY', 'host-mask', 'host-mask')).toBe(false);
  });
});
