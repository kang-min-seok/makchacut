import {
  type DayType,
  type LaterWay,
  type OtherAnchor,
  type RideLeg,
  type TransitGraph,
  type TripPlan,
} from '@makchacut/core';
import type {
  PlanAnchor,
  PlanLater,
  PlanOtherAnchor,
  PlanRequest,
  PlanResponse,
} from '@makchacut/shared';
import { type FormatContext, formatWay, rideTimeKind } from '#plan/format-way';
import { serviceMinutesToIso } from '#plan/service-time-iso';

// 엔진 계산 결과(서비스 일자 기준 분, 정류장 번호)를 응답 형태(+09:00 ISO 시각, 이름)로 바꾼다

export const PLAN_NOTES = {
  estimated: '추정 시각이 들어간 구간이 있어요. 표시보다 조금 일찍 움직이세요.',
  detourFallback: '설정한 우회 한도 안에서는 집에 가는 경로가 없어 돌아가는 경로로 안내해요',
} as const;

function formatAnchor(graph: TransitGraph, date: string, leg: RideLeg): PlanAnchor {
  return {
    routeName: graph.patternRouteNames[leg.pattern]!,
    stopName: graph.stopNames[leg.fromStop]!,
    time: serviceMinutesToIso(date, leg.depart),
    timeKind: rideTimeKind(leg),
    source: leg.timeSource,
    confidence: leg.confidence,
  };
}

function formatLater(context: FormatContext, later: LaterWay): PlanLater {
  const way = formatWay(context, later.way);
  return { latestDeparture: way.latestDeparture, extraTransfers: later.extraRides, way };
}

// 다른 막차의 경로는 그 막차 구간을 핵심 연결로 표시한다
function formatOtherAnchor(context: FormatContext, other: OtherAnchor): PlanOtherAnchor {
  const { graph, date } = context;
  return {
    ...formatAnchor(graph, date, other.anchor),
    latestDeparture: serviceMinutesToIso(date, other.deadline, Math.floor),
    way: formatWay({ ...context, anchor: other.anchor }, other.way),
  };
}

export function formatPlan(
  graph: TransitGraph,
  request: Pick<PlanRequest, 'date' | 'home' | 'meetup'>,
  dayType: DayType,
  plan: TripPlan,
): PlanResponse {
  const { date } = request;
  const context: FormatContext = { graph, ...request, anchor: plan.anchor };
  const ways = plan.ways.map((way) => formatWay(context, way));
  const notes: string[] = [];
  if (ways.some((way) => way.steps.some((s) => s.type !== 'walk' && s.timeKind === 'estimated'))) {
    notes.push(PLAN_NOTES.estimated);
  }
  if (plan.detourFallback) notes.push(PLAN_NOTES.detourFallback);
  return {
    deadline: serviceMinutesToIso(date, plan.deadline, Math.floor),
    dayType,
    anchor: plan.anchor ? formatAnchor(graph, date, plan.anchor) : null,
    ways,
    detour: plan.detour
      ? {
          deadline: serviceMinutesToIso(date, plan.detour.deadline, Math.floor),
          extraMinutes: plan.detour.extraMinutes,
        }
      : null,
    later: plan.later ? formatLater(context, plan.later) : null,
    otherAnchors: plan.otherAnchors.map((other) => formatOtherAnchor(context, other)),
    notes,
  };
}
