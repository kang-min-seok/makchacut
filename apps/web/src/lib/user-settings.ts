import type { z } from 'zod';
import {
  DEFAULT_PLAN_OPTIONS,
  type DETOUR_LEVELS,
  PlanOptionsSchema,
  type WALK_SPEEDS,
} from '@makchacut/shared';
import { createStoredValue } from '@/lib/storage/stored-value';

// 사용자가 바꿀 수 있는 계산 설정. 최대 환승·최대 걷기는 엔진 기본값을 쓴다.
export const UserSettingsSchema = PlanOptionsSchema.pick({
  detour: true,
  safetyMarginMinutes: true,
  walkSpeed: true,
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  detour: DEFAULT_PLAN_OPTIONS.detour,
  safetyMarginMinutes: DEFAULT_PLAN_OPTIONS.safetyMarginMinutes,
  walkSpeed: DEFAULT_PLAN_OPTIONS.walkSpeed,
};

export const userSettings = createStoredValue('makchacut:settings', UserSettingsSchema);

export const DETOUR_LABELS: Readonly<Record<(typeof DETOUR_LEVELS)[number], string>> = {
  optimal: '최적 경로만',
  some: '조금 돌아가도',
  any: '집에만 가면',
};

export const WALK_SPEED_LABELS: Readonly<Record<(typeof WALK_SPEEDS)[number], string>> = {
  slow: '천천히',
  normal: '보통',
  fast: '빠르게',
};

export const SAFETY_MARGIN_CHOICES = [0, 5, 10, 15] as const;
