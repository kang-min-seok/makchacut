import { z } from 'zod';

export const DETOUR_LEVELS = ['optimal', 'some', 'any'] as const;
export const WALK_SPEEDS = ['slow', 'normal', 'fast'] as const;

const MAX_TRANSFERS_LIMIT = 4;
const MAX_WALK_MINUTES_LIMIT = 30;
const MAX_SAFETY_MARGIN_MINUTES = 30;

export const PlanOptionsSchema = z.object({
  detour: z.enum(DETOUR_LEVELS),
  maxTransfers: z.number().int().min(0).max(MAX_TRANSFERS_LIMIT),
  maxWalkMinutes: z.number().int().min(1).max(MAX_WALK_MINUTES_LIMIT),
  safetyMarginMinutes: z.number().int().min(0).max(MAX_SAFETY_MARGIN_MINUTES),
  walkSpeed: z.enum(WALK_SPEEDS),
});

export type PlanOptions = z.infer<typeof PlanOptionsSchema>;

export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
  detour: 'some',
  maxTransfers: 2,
  maxWalkMinutes: 15,
  safetyMarginMinutes: 5,
  walkSpeed: 'normal',
};

export function resolvePlanOptions(partial: Partial<PlanOptions> = {}): PlanOptions {
  return { ...DEFAULT_PLAN_OPTIONS, ...partial };
}
