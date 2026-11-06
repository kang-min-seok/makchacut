import {
  type DayType,
  type JourneyLeg,
  modeOf,
  patternStopsBetween,
  type PlannedWay,
  type RideLeg,
  type TransitGraph,
  type TripPlan,
} from '@makchacut/core';
import type {
  LatLng,
  PlanAnchor,
  PlanRequest,
  PlanResponse,
  PlanStep,
  PlanWay,
} from '@makchacut/shared';

// 엔진 계산 결과(서비스 일자 기준 분, 정류장 번호)를 응답 형태(+09:00 ISO 시각, 이름)로 바꾼다

const KST_OFFSET = '+09:00';
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MEETUP_LABEL = '약속 장소';
const HOME_LABEL = '집';

export const PLAN_NOTES = {
  estimated: '추정 시각이 들어간 구간이 있어요. 표시보다 조금 일찍 움직이세요.',
  detourFallback: '설정한 우회 한도 안에서는 집에 가는 경로가 없어 돌아가는 경로로 안내해요',
} as const;

type TimeKind = PlanStep['timeKind'];

// 응답 한 건을 만드는 데 필요한 요청 정보와 핵심 연결
export type FormatContext = {
  graph: TransitGraph;
  date: string;
  home: LatLng;
  meetup: LatLng;
  anchor: RideLeg | undefined;
};

const pad = (value: number) => String(value).padStart(2, '0');

// 경로 안 시각은 반올림(앞뒤 구간 순서가 뒤집히지 않게), 마감은 내림(늦게 알려 주지 않게)
export function serviceMinutesToIso(
  date: string,
  minutes: number,
  round: (value: number) => number = Math.round,
): string {
  const whole = round(minutes);
  const dayOffset = Math.floor(whole / MINUTES_PER_DAY);
  const inDay = whole - dayOffset * MINUTES_PER_DAY;
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + dayOffset);
  const ymd = day.toISOString().slice(0, 10);
  const clock = `${pad(Math.floor(inDay / MINUTES_PER_HOUR))}:${pad(inDay % MINUTES_PER_HOUR)}`;
  return `${ymd}T${clock}:00${KST_OFFSET}`;
}

export function rideTimeKind(leg: RideLeg): TimeKind {
  if (leg.headwayMinutes !== null) return 'estimated';
  return leg.timeSource === 'timetable' || leg.confidence === 'high' ? 'scheduled' : 'estimated';
}

const walkMinutesOf = (legs: readonly JourneyLeg[]) =>
  legs.reduce((sum, leg) => sum + (leg.kind === 'walk' ? leg.seconds / SECONDS_PER_MINUTE : 0), 0);

// 좌표 없는 정류장은 undefined
function stopPoint(graph: TransitGraph, stop: number): LatLng | undefined {
  const lat = graph.stopLats[stop]!;
  const lng = graph.stopLngs[stop]!;
  return Number.isNaN(lat) || Number.isNaN(lng) ? undefined : { lat, lng };
}

const pathOf = (points: readonly (LatLng | undefined)[]): LatLng[] =>
  points.filter((point): point is LatLng => point !== undefined);

type WalkEnd = { name: string; point: LatLng | undefined };

const stopEnd = (graph: TransitGraph, stop: number): WalkEnd => ({
  name: graph.stopNames[stop]!,
  point: stopPoint(graph, stop),
});

function walkStep(
  date: string,
  from: WalkEnd,
  to: WalkEnd,
  depart: number,
  minutes: number,
  roundDepart: (value: number) => number = Math.round,
): PlanStep {
  return {
    type: 'walk',
    from: from.name,
    to: to.name,
    depart: serviceMinutesToIso(date, depart, roundDepart),
    arrive: serviceMinutesToIso(date, depart + minutes),
    timeKind: 'estimated',
    path: pathOf([from.point, to.point]),
    isAnchor: false,
  };
}

const isSameRide = (leg: RideLeg, anchor: RideLeg | undefined) =>
  anchor !== undefined &&
  leg.pattern === anchor.pattern &&
  leg.trip === anchor.trip &&
  leg.fromStop === anchor.fromStop;

function rideStep({ graph, date, anchor }: FormatContext, leg: RideLeg): PlanStep {
  const stops = patternStopsBetween(graph, leg.pattern, leg.fromStop, leg.toStop);
  return {
    type: modeOf(graph, leg.pattern),
    from: graph.stopNames[leg.fromStop]!,
    to: graph.stopNames[leg.toStop]!,
    routeName: graph.patternRouteNames[leg.pattern]!,
    depart: serviceMinutesToIso(date, leg.depart),
    arrive: serviceMinutesToIso(date, leg.arrive),
    timeKind: rideTimeKind(leg),
    path: pathOf(stops.map((stop) => stopPoint(graph, stop))),
    isAnchor: isSameRide(leg, anchor),
  };
}

// 첫 탑승 전 도보는 약속 장소 도보에, 마지막 하차 뒤 도보는 집까지 도보에 합친다
export function formatWay(context: FormatContext, way: PlannedWay): PlanWay {
  const { graph, date } = context;
  const meetup: WalkEnd = { name: MEETUP_LABEL, point: context.meetup };
  const home: WalkEnd = { name: HOME_LABEL, point: context.home };
  const rides = way.legs.flatMap((leg, i) => (leg.kind === 'ride' ? [i] : []));
  const steps: PlanStep[] = [];
  if (rides.length === 0) {
    const minutes = way.meetupWalkMinutes + walkMinutesOf(way.legs) + way.homeWalkMinutes;
    steps.push(walkStep(date, meetup, home, way.latestDeparture, minutes, Math.floor));
    return { latestDeparture: serviceMinutesToIso(date, way.latestDeparture, Math.floor), steps };
  }
  const first = rides[0]!;
  const last = rides.at(-1)!;
  const firstRide = way.legs[first] as RideLeg;
  const leadMinutes = way.meetupWalkMinutes + walkMinutesOf(way.legs.slice(0, first));
  steps.push(
    walkStep(
      date,
      meetup,
      stopEnd(graph, firstRide.fromStop),
      way.latestDeparture,
      leadMinutes,
      Math.floor,
    ),
  );
  let time = firstRide.depart;
  for (const leg of way.legs.slice(first, last + 1)) {
    if (leg.kind === 'ride') {
      steps.push(rideStep(context, leg));
      time = leg.arrive;
      continue;
    }
    const minutes = leg.seconds / SECONDS_PER_MINUTE;
    steps.push(
      walkStep(date, stopEnd(graph, leg.fromStop), stopEnd(graph, leg.toStop), time, minutes),
    );
    time += minutes;
  }
  const lastRide = way.legs[last] as RideLeg;
  const tailMinutes = walkMinutesOf(way.legs.slice(last + 1)) + way.homeWalkMinutes;
  steps.push(walkStep(date, stopEnd(graph, lastRide.toStop), home, lastRide.arrive, tailMinutes));
  return { latestDeparture: serviceMinutesToIso(date, way.latestDeparture, Math.floor), steps };
}

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
    notes,
  };
}
