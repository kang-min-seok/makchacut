import { describe, expect, it } from 'vitest';
import {
  buildTransitGraph,
  type GraphFootpathInput,
  type GraphTripInput,
} from '#graph/build-graph';
import { indexGraph } from '#graph/graph-index';
import type { TransitMode } from '#graph/transit-graph';
import type { AccessStop } from '#plan/access';
import type { DetourLevel } from '#plan/detour';
import { searchHome } from '#plan/home-search';
import { isLastRun } from '#plan/key-connection';
import { planTrip, type TripPlanOptions } from '#plan/plan-trip';
import type { RideLeg } from '#raptor/journey';
import { toServiceMinutes } from '#time/service-day';

// 가상 노선망: 약속 장소 정류장 M·M2 → (배차 버스 10·11) → 환승 거점 P → (막차 버스 20) → 집.
// 돌아가는 길: M → (지하철 30) → F → (지하철 31, 오래 걸림) → 집.
const M = 1;
const M2 = 2;
const P = 3;
const HOME = 4;
const F = 5;
// 집 근처 정류장 (집 진입점은 아니고 걸어서 집 정류장으로)
const H2 = 6;
const STOPS = [M, M2, P, HOME, F, H2].map((id) => ({ id, name: `S${id}`, lat: null, lng: null }));

function m(clock: string): number {
  const minutes = toServiceMinutes(clock);
  if (minutes === undefined) throw new Error(clock);
  return minutes;
}

function trip(
  routeId: number,
  stops: readonly number[],
  start: string,
  gapMinutes: number,
  mode: TransitMode,
  headwayMinutes: number | null = null,
): GraphTripInput {
  return {
    routeId,
    routeName: `R${routeId}`,
    mode,
    label: `${routeId}@${start}`,
    headwayMinutes,
    stopTimes: stops.map((stopId, i) => {
      const time = m(start) + i * gapMinutes;
      return { stopId, arrival: time, departure: time, source: 'timetable', confidence: 'high' };
    }),
  };
}

const TRIPS = [
  trip(10, [M, P], '00:00', 20, 'bus', 10),
  trip(11, [M2, P], '00:05', 15, 'bus', 15),
  trip(20, [P, HOME], '23:55', 40, 'bus', 20),
  trip(30, [M, F], '23:50', 30, 'subway'),
  trip(31, [F, HOME], '00:30', 90, 'subway'),
];

const OPTIONS: TripPlanOptions = {
  maxRides: 3,
  minTransferMinutes: 1,
  walkTimeFactor: 1,
  safetyMarginMinutes: 5,
};

function plan(
  detour: DetourLevel,
  trips: GraphTripInput[] = TRIPS,
  footpaths: GraphFootpathInput[] = [],
) {
  const { graph } = buildTransitGraph({ stops: STOPS, trips, footpaths });
  const index = indexGraph(graph);
  const at = (id: number) => index.stopIndexById.get(id)!;
  const homeAccess: AccessStop[] = [{ stop: at(HOME), walkMinutes: 0 }];
  const meetupAccess: AccessStop[] = [
    { stop: at(M), walkMinutes: 2 },
    { stop: at(M2), walkMinutes: 4 },
  ];
  const result = planTrip({
    graph,
    index,
    homeAccess,
    ...searchHome(graph, index, homeAccess, OPTIONS, detour),
    meetupAccess,
    options: OPTIONS,
  });
  const routeOf = (leg: RideLeg) => graph.patternRouteIds[leg.pattern];
  return { graph, index, result: result!, routeOf, stopId: (stop: number) => graph.stopIds[stop] };
}

const firstRideRoute = (way: { legs: readonly { kind: string; pattern?: number }[] }) =>
  way.legs.find((leg) => leg.kind === 'ride');

describe('planTrip', () => {
  it('keeps the detour out of the optimal layer and reports it separately', () => {
    const { result, routeOf, stopId } = plan('optimal');
    // 배차 버스 10: 막차(00:00)로는 P 23:54에 못 닿아 23:54 − 20 − 10(최악 대기) = 23:24, 도보 2·여유 5
    expect(result.deadline).toBeCloseTo(m('23:17'));
    expect(result.anchor && routeOf(result.anchor)).toBe(20);
    expect(result.anchor && stopId(result.anchor.fromStop)).toBe(P);
    // 돌아가는 길: 23:50 − 7 = 23:43, 소요 130분 vs 71분
    expect(result.detour?.deadline).toBeCloseTo(m('23:43'));
    expect(result.detour?.extraMinutes).toBe(59);
    expect(result.detourFallback).toBe(false);
  });

  it('keeps routes that end with a walk to the home stop in the limited search', () => {
    const trips = TRIPS.map((t) =>
      t.routeId === 20 ? trip(20, [P, H2], '23:55', 40, 'bus', 20) : t,
    );
    const walk = { fromStopId: H2, toStopId: HOME, walkSeconds: 180 };
    const { result } = plan('optimal', trips, [walk, { ...walk, fromStopId: HOME, toStopId: H2 }]);
    expect(result.detourFallback).toBe(false);
    expect(result.deadline).toBeCloseTo(m('23:17'));
  });

  it('allows the detour when the setting is loose enough', () => {
    const { result, routeOf } = plan('some');
    expect(result.deadline).toBeCloseTo(m('23:43'));
    expect(result.detour).toBeUndefined();
    // 막차 30·31 중 집에 가까운 31
    expect(result.anchor && routeOf(result.anchor)).toBe(31);
  });

  it('never lists a way that leaves later than the deadline', () => {
    for (const level of ['optimal', 'some', 'any'] as const) {
      const { result } = plan(level);
      expect(result.ways[0]?.latestDeparture).toBeCloseTo(result.deadline);
      for (const way of result.ways) {
        expect(way.latestDeparture).toBeLessThanOrEqual(result.deadline);
      }
    }
  });

  it('lists distinct ways to the key connection stop', () => {
    const { result, graph } = plan('optimal');
    expect(result.ways).toHaveLength(2);
    const routes = result.ways.map((way) => {
      const ride = firstRideRoute(way) as RideLeg;
      return graph.patternRouteIds[ride.pattern];
    });
    expect(routes).toEqual([10, 11]);
    expect(result.ways[1]?.latestDeparture).toBeCloseTo(m('23:15'));
    // 모든 방법이 핵심 연결 이후 구간을 공유한다
    for (const way of result.ways) {
      expect(way.legs.at(-1)).toMatchObject({ kind: 'ride' });
    }
  });
});

describe('isLastRun', () => {
  // 완행 22:00 A→B→C, 급행 22:10 A→C (B 미정차)
  const A = 1;
  const B = 2;
  const C = 3;
  const { graph } = buildTransitGraph({
    stops: [A, B, C].map((id) => ({ id, name: `S${id}`, lat: null, lng: null })),
    trips: [
      trip(1, [A, B, C], '22:00', 5, 'subway'),
      trip(1, [A, C], '22:10', 5, 'subway'),
      trip(1, [A, B], '22:20', 5, 'subway'),
    ],
    footpaths: [],
  });
  const index = indexGraph(graph);
  const at = (id: number) => index.stopIndexById.get(id)!;
  const leg = (from: number, to: number): RideLeg => {
    const pattern = index.stopPatterns[index.stopPatternOffsets[at(from)]!]!;
    return {
      kind: 'ride',
      pattern,
      trip: graph.patternTripOffsets[pattern]!,
      fromStop: at(from),
      toStop: at(to),
      depart: from === A ? m('22:00') : m('22:05'),
      arrive: m('22:10'),
      headwayMinutes: null,
      timeSource: 'timetable',
      confidence: 'high',
    };
  };

  it('treats a later express that skips the stop as no later trip', () => {
    expect(isLastRun(graph, index, leg(B, C))).toBe(true);
  });

  it('treats a later trip on the same route as a later trip', () => {
    expect(isLastRun(graph, index, leg(A, C))).toBe(false);
  });

  it('counts a later short-turn trip that still reaches the stop', () => {
    expect(isLastRun(graph, index, leg(A, B))).toBe(false);
  });
});
