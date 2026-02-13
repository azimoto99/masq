import type { NarrativePhase, NarrativeRoleDefinition, NarrativeRoomStatus } from '@masq/shared';

export interface NarrativeRoleAssignmentPlan {
  maskId: string;
  role: NarrativeRoleDefinition;
  secretPayload: unknown;
}

export interface NarrativePhaseTransition {
  phaseIndex: number;
  phase: NarrativePhase;
  phaseEndsAt: Date;
}

export interface NarrativeStartEmissionPlan {
  phaseChanged: {
    roomId: string;
    phaseIndex: number;
    phase: NarrativePhase;
    phaseEndsAt: Date;
  };
  roleAssigned: Array<{
    roomId: string;
    maskId: string;
    roleKey: string;
    role: NarrativeRoleDefinition;
    secretPayload: unknown;
  }>;
}

const copyAndShuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }
  return next;
};

export const createSeededRandom = (seed: number): (() => number) => {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    // Mulberry32: compact deterministic PRNG suitable for reproducible room role assignment.
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export const assignNarrativeRoles = (
  maskIds: readonly string[],
  roleDefinitions: readonly NarrativeRoleDefinition[],
  random: () => number = Math.random,
): NarrativeRoleAssignmentPlan[] => {
  if (maskIds.length === 0) {
    return [];
  }

  if (roleDefinitions.length === 0) {
    throw new Error('Narrative roles are required');
  }

  const rolePool: NarrativeRoleDefinition[] = [];
  for (const role of roleDefinitions) {
    const count = Math.max(1, Math.floor(role.count));
    for (let index = 0; index < count; index += 1) {
      rolePool.push(role);
    }
  }

  while (rolePool.length < maskIds.length) {
    rolePool.push(roleDefinitions[0]);
  }

  const shuffledMasks = copyAndShuffle(maskIds, random);
  const shuffledRoles = copyAndShuffle(rolePool, random);

  return shuffledMasks.map((maskId, index) => {
    const role = shuffledRoles[index] ?? roleDefinitions[0];
    return {
      maskId,
      role,
      secretPayload: role.secretPayload ?? null,
    };
  });
};

export const getNarrativePhaseTransition = (
  phases: readonly NarrativePhase[],
  phaseIndex: number,
  now: Date = new Date(),
): NarrativePhaseTransition | null => {
  const phase = phases[phaseIndex];
  if (!phase) {
    return null;
  }

  return {
    phaseIndex,
    phase,
    phaseEndsAt: new Date(now.getTime() + phase.durationSec * 1000),
  };
};

export const advanceNarrativePhase = (
  phases: readonly NarrativePhase[],
  currentPhaseIndex: number,
  now: Date = new Date(),
): NarrativePhaseTransition | null => {
  return getNarrativePhaseTransition(phases, currentPhaseIndex + 1, now);
};

export const canActorStartNarrative = (
  status: NarrativeRoomStatus,
  actorMaskId: string,
  hostMaskId: string,
): boolean => {
  return status === 'LOBBY' && actorMaskId === hostMaskId;
};

export const canActorAdvanceNarrative = (
  status: NarrativeRoomStatus,
  actorMaskId: string,
  hostMaskId: string,
): boolean => {
  return status === 'RUNNING' && actorMaskId === hostMaskId;
};

export const shouldAutoAdvanceNarrativePhase = (
  status: NarrativeRoomStatus,
  phaseEndsAt: Date | null,
  now: Date = new Date(),
): boolean => {
  if (status !== 'RUNNING' || !phaseEndsAt) {
    return false;
  }

  return phaseEndsAt.getTime() <= now.getTime();
};

export const buildNarrativeStartEmissionPlan = (
  roomId: string,
  transition: NarrativePhaseTransition,
  assignments: readonly NarrativeRoleAssignmentPlan[],
): NarrativeStartEmissionPlan => {
  return {
    phaseChanged: {
      roomId,
      phaseIndex: transition.phaseIndex,
      phase: transition.phase,
      phaseEndsAt: transition.phaseEndsAt,
    },
    roleAssigned: assignments.map((assignment) => ({
      roomId,
      maskId: assignment.maskId,
      roleKey: assignment.role.key,
      role: assignment.role,
      secretPayload: assignment.secretPayload ?? null,
    })),
  };
};
