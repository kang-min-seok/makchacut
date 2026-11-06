import type { PlanDayType } from '@makchacut/shared';
import { DAY_TYPE_LABELS, formatDateLabel, guessDayType } from '@/lib/korea-time';
import type { PlanTarget } from '@/lib/plan-target';

export function planTitle(target: PlanTarget): string {
  return `${target.name} → 집`;
}

// "11월 6일 (금) · 평일 시간표". 응답 전에는 요일로 짐작한다.
export function planDateLine(target: PlanTarget, dayType: PlanDayType | undefined): string {
  const type = dayType ?? guessDayType(target.date);
  return `${formatDateLabel(target.date)} · ${DAY_TYPE_LABELS[type]} 시간표`;
}
