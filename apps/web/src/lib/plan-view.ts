import type { PlanResponse, PlanStep, PlanWay } from '@makchacut/shared';
import { minutesBetween } from '@/lib/korea-time';

// 결과 화면이 응답에서 꺼내 쓰는 값들 (순수 함수)

// 이 시간보다 적게 남으면 남은 시간을 급한 색으로 보여 준다(M3 임박 확인과 같은 기준)
export const URGENT_MINUTES = 30;

export type CountdownTone = 'calm' | 'urgent';

export function countdownTone(minutesLeft: number): CountdownTone {
  return minutesLeft <= URGENT_MINUTES ? 'urgent' : 'calm';
}

const isRide = (step: PlanStep) => step.type !== 'walk';

export function anchorStepOf(way: PlanWay | undefined): PlanStep | undefined {
  return way?.steps.find((step) => step.isAnchor);
}

export const MODE_LABELS: Readonly<Record<Exclude<PlanStep['type'], 'walk'>, string>> = {
  bus: '버스',
  subway: '지하철',
};

// 가장 늦은 방법이 걸어가서 바로 핵심 연결을 타면 "○○까지 가는 방법"은 보여 줄 필요가 없다
export function hasWaysToAnchor(plan: PlanResponse): boolean {
  const firstRide = plan.ways[0]?.steps.find(isRide);
  return firstRide !== undefined && !firstRide.isAnchor && anchorStepOf(plan.ways[0]) !== undefined;
}

// 카드 요약: 핵심 연결까지(포함)의 단계
export function stepsToAnchor(way: PlanWay): PlanStep[] {
  const anchorIndex = way.steps.findIndex((step) => step.isAnchor);
  return anchorIndex < 0 ? way.steps : way.steps.slice(0, anchorIndex + 1);
}

export function firstRideOf(way: PlanWay): PlanStep | undefined {
  return way.steps.find(isRide);
}

export function stepMinutes(step: PlanStep): number {
  return minutesBetween(step.depart, step.arrive);
}

export function hasEstimatedRide(way: PlanWay): boolean {
  return way.steps.some((step) => isRide(step) && step.timeKind === 'estimated');
}

export type WaySummary = {
  totalMinutes: number;
  transfers: number;
  walkMinutes: number;
  arrive: string;
};

export function summarizeWay(way: PlanWay): WaySummary {
  const last = way.steps.at(-1);
  const arrive = last?.arrive ?? way.latestDeparture;
  const rides = way.steps.filter(isRide).length;
  return {
    totalMinutes: minutesBetween(way.latestDeparture, arrive),
    transfers: Math.max(rides - 1, 0),
    walkMinutes: way.steps
      .filter((step) => !isRide(step))
      .reduce((sum, step) => sum + stepMinutes(step), 0),
    arrive,
  };
}
