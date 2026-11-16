import type { PlanResponse, PlanStep, PlanWay } from '@makchacut/shared';
import { formatKoreaClock, minutesBetween } from '@/lib/korea-time';
import { FIRST_WAY, type WayRef } from '@/lib/plan-target';

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

export type SelectedWay = { way: PlanWay; title: string };

// 상세 화면이 보여 줄 경로와 제목. 응답에 없는 경로면 undefined
export function selectWay(plan: PlanResponse, ref: WayRef): SelectedWay | undefined {
  if (ref.kind === 'later') {
    const { later } = plan;
    if (!later) return undefined;
    const clock = formatKoreaClock(later.latestDeparture);
    return { way: later.way, title: `환승 ${later.extraTransfers}번 더 · ${clock} 출발` };
  }
  if (ref.kind === 'anchor') {
    const other = plan.otherAnchors[ref.index];
    if (!other) return undefined;
    const clock = formatKoreaClock(other.latestDeparture);
    return { way: other.way, title: `${other.routeName} 막차 · ${clock} 출발` };
  }
  const way = plan.ways[ref.index];
  if (!way) return undefined;
  return { way, title: `방법 ${ref.index + 1} · ${formatKoreaClock(way.latestDeparture)} 출발` };
}

export type AnchorRow = {
  routeName: string;
  type: Exclude<PlanStep['type'], 'walk'>;
  stopName: string;
  // 막차 시각
  time: string;
  // 이 막차를 타려면 약속 장소에서 늦어도 이 시각에 나서야 한다
  latestDeparture: string;
  estimated: boolean;
  // 결과 화면의 대표 핵심 연결
  recommended: boolean;
  ref: WayRef;
};

const DEFAULT_RIDE_TYPE: AnchorRow['type'] = 'bus';

function rideTypeOf(way: PlanWay | undefined): AnchorRow['type'] {
  const step = anchorStepOf(way);
  return step && step.type !== 'walk' ? step.type : DEFAULT_RIDE_TYPE;
}

// 다른 막차 화면 목록: 대표 핵심 연결(추천)과 다른 막차를 출발 마감 늦은 순으로
export function anchorRows(plan: PlanResponse): AnchorRow[] {
  const { anchor } = plan;
  if (!anchor) return [];
  const main: AnchorRow = {
    routeName: anchor.routeName,
    type: rideTypeOf(plan.ways[0]),
    stopName: anchor.stopName,
    time: anchor.time,
    latestDeparture: plan.deadline,
    estimated: anchor.timeKind === 'estimated',
    recommended: true,
    ref: FIRST_WAY,
  };
  const others = plan.otherAnchors.map((other, index): AnchorRow => ({
    routeName: other.routeName,
    type: rideTypeOf(other.way),
    stopName: other.stopName,
    time: other.time,
    latestDeparture: other.latestDeparture,
    estimated: other.timeKind === 'estimated',
    recommended: false,
    ref: { kind: 'anchor', index },
  }));
  return [main, ...others].sort(
    (a, b) => Date.parse(b.latestDeparture) - Date.parse(a.latestDeparture),
  );
}
