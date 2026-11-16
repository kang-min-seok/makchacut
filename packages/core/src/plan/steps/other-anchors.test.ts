import { describe, expect, it } from 'vitest';
import { buildTransitGraph, type GraphTripInput } from '#graph/build-graph';
import { indexGraph } from '#graph/graph-index';
import type { AccessStop } from '#plan/access';
import { searchHome } from '#plan/home-search';
import { planTrip } from '#plan/plan-trip';
import {
  MAX_OTHER_ANCHORS,
  OTHER_ANCHOR_WINDOW_MINUTES,
  searchHomeExcluding,
} from '#plan/steps/other-anchors';
import type { TripPlanOptions } from '#plan/trip-plan';
import { toServiceMinutes } from '#time/service-day';

// 가상 노선망: 약속 장소 정류장 M에서 집으로 가는 직행 막차들, M → (지하철 10) → 다른 거점 Q → (막차 40) → 집
const M = 1;
const Q = 2;
const HOME = 3;
const STOPS = [M, Q, HOME].map((id) => ({ id, name: `S${id}`, lat: null, lng: null }));
const SUBWAY_TO_Q = 10;
const FROM_Q = 40;
const MEETUP_WALK_MINUTES = 2;
const MINUTES_PER_HOUR = 60;

const OPTIONS: TripPlanOptions = {
  maxRides: 3,
  minTransferMinutes: 1,
  walkTimeFactor: 1,
  safetyMarginMinutes: 5,
};

function m(clock: string): number {
  const minutes = toServiceMinutes(clock);
  if (minutes === undefined) throw new Error(clock);
  return minutes;
}

function trip(
  routeId: number,
  stops: readonly number[],
  start: number,
  gapMinutes: number,
  routeName = `R${routeId}`,
): GraphTripInput {
  return {
    routeId,
    routeName,
    mode: 'bus',
    label: `${routeId}@${start}`,
    headwayMinutes: null,
    stopTimes: stops.map((stopId, i) => {
      const time = start + i * gapMinutes;
      return { stopId, arrival: time, departure: time, source: 'timetable', confidence: 'high' };
    }),
  };
}

const direct = (routeId: number, clock: string, routeName?: string) =>
  trip(routeId, [M, HOME], m(clock), 40, routeName);

// 10분 간격 지하철 M → Q (막차가 아니라 핵심 연결이 되지 않는다)
const SUBWAY = Array.from({ length: 12 }, (_, i) =>
  trip(SUBWAY_TO_Q, [M, Q], m('22:30') + i * 10, 10),
);

function otherAnchorsOf(trips: GraphTripInput[], withSearch = true) {
  const { graph } = buildTransitGraph({ stops: STOPS, trips, footpaths: [] });
  const index = indexGraph(graph);
  const at = (id: number) => index.stopIndexById.get(id)!;
  const homeAccess: AccessStop[] = [{ stop: at(HOME), walkMinutes: 0 }];
  const homeSearch = searchHome(graph, index, homeAccess, OPTIONS, 'any');
  const searches: number[][] = [];
  const plan = planTrip({
    graph,
    index,
    homeAccess,
    homeSearch,
    meetupAccess: [{ stop: at(M), walkMinutes: MEETUP_WALK_MINUTES }],
    options: OPTIONS,
    searchExcluding: withSearch
      ? (excluded) => {
          searches.push([...excluded]);
          return searchHomeExcluding(
            graph,
            index,
            homeAccess,
            OPTIONS,
            homeSearch,
            'any',
            excluded,
          );
        }
      : undefined,
  })!;
  const routeOf = (pattern: number) => graph.patternRouteIds[pattern];
  return {
    plan,
    searches,
    routes: plan.otherAnchors.map((other) => routeOf(other.anchor.pattern)),
    boardStops: plan.otherAnchors.map((other) => graph.stopIds[other.anchor.fromStop]),
  };
}

const leaveBy = (clock: string) => m(clock) - MEETUP_WALK_MINUTES - OPTIONS.safetyMarginMinutes;

describe('findOtherAnchors', () => {
  it('lists the other last buses home, latest deadline first, including another hub', () => {
    const trips = [
      direct(1, '23:50'),
      direct(2, '23:40'),
      direct(3, '23:20'),
      ...SUBWAY,
      trip(FROM_Q, [Q, HOME], m('23:30'), 30),
    ];
    const { plan, routes, boardStops } = otherAnchorsOf(trips);
    expect(plan.deadline).toBeCloseTo(leaveBy('23:50'));
    expect(routes).toEqual([2, 3, FROM_Q]);
    expect(boardStops).toEqual([M, M, Q]);
    const [second, third, viaHub] = plan.otherAnchors;
    expect(second?.deadline).toBeCloseTo(leaveBy('23:40'));
    expect(third?.deadline).toBeCloseTo(leaveBy('23:20'));
    // 23:10 지하철 → Q 23:20 → 23:30 막차
    expect(viaHub?.deadline).toBeCloseTo(leaveBy('23:10'));
    expect(viaHub?.way.legs.at(-1)).toEqual(viaHub?.anchor);
  });

  it('is empty when no other route reaches home', () => {
    expect(otherAnchorsOf([direct(1, '23:50')]).routes).toEqual([]);
  });

  it('is empty without an excluded search', () => {
    const { routes, searches } = otherAnchorsOf([direct(1, '23:50'), direct(2, '23:40')], false);
    expect(routes).toEqual([]);
    expect(searches).toEqual([]);
  });

  it('skips a route registered twice under the same name but keeps excluding it', () => {
    const trips = [direct(1, '23:50'), direct(2, '23:40'), direct(5, '23:45', 'R1')];
    const { routes, searches } = otherAnchorsOf(trips);
    expect(routes).toEqual([2]);
    expect(searches.at(-1)).toEqual([1, 5, 2]);
  });

  it('stops at the count limit', () => {
    const trips = Array.from({ length: MAX_OTHER_ANCHORS + 3 }, (_, i) =>
      trip(i + 1, [M, HOME], m('23:50') - i, 40),
    );
    expect(otherAnchorsOf(trips).routes).toHaveLength(MAX_OTHER_ANCHORS);
  });

  it('leaves out last buses far earlier than the deadline', () => {
    const tooEarly = m('23:50') - OTHER_ANCHOR_WINDOW_MINUTES - MINUTES_PER_HOUR;
    const trips = [direct(1, '23:50'), direct(2, '23:00'), trip(3, [M, HOME], tooEarly, 40)];
    expect(otherAnchorsOf(trips).routes).toEqual([2]);
  });
});
