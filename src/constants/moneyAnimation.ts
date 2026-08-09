export const MONEY_ANIMATION_DURATION_MS = 900;
export const MONEY_ANIMATION_MIN_PARTICLE_COUNT = 3;
export const MONEY_ANIMATION_MAX_PARTICLE_COUNT = 12;

export const MONEY_ANIMATION_PARTICLE_STEPS = [
  { minimumAmountYen: 1, particleCount: 3 },
  { minimumAmountYen: 1_000, particleCount: 5 },
  { minimumAmountYen: 10_000, particleCount: 7 },
  { minimumAmountYen: 100_000, particleCount: 9 },
  { minimumAmountYen: 1_000_000, particleCount: 11 },
  { minimumAmountYen: 10_000_000, particleCount: 12 },
] as const;
