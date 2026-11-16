import { describe, expect, it } from 'vitest';
import { buildTransitGraph, type GraphTripInput } from '#graph/build-graph';
import { indexGraph } from '#graph/graph-index';
import { reconstructJourney } from '#raptor/journey';
import { reverseRaptor, type ReverseRaptorOptions } from '#raptor/reverse-raptor';
import { toServiceMinutes } from '#time/service-day';

// 가상 노선망: A에서 집으로 가는 직행 1(23:50)·2(23:30), 배차 버스 3, B를 거쳐 가는 4 → 5
const A = 1;
const B = 2;
const HOME = 3;
const STOPS = [A, B, HOME].map((id) => ({ id, name: `S${id}`, lat: null, lng: null }));
const DIRECT_LATE = 1;
const DIRECT_EARLY = 2;
const HEADWAY_BUS = 3;
const TO_B = 4;
const B_HOME = 5;

const OPTIONS: ReverseRaptorOptions = { maxRides: 3, minTransferMinutes: 1, walkTimeFactor: 1 };

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
  headwayMinutes: number | null = null,
): GraphTripInput {
  return {
    routeId,
    routeName: `L${routeId}`,
    mode: headwayMinutes === null ? 'subway' : 'bus',
    label: `${routeId}@${start}`,
    headwayMinutes,
    stopTimes: stops.map((stopId, i) => {
      const time = m(start) + i * gapMinutes;
      return { stopId, arrival: time, departure: time, source: 'timetable', confidence: 'high' };
    }),
  };
}

const TRIPS = [
  trip(DIRECT_LATE, [A, HOME], '23:50', 30),
  trip(DIRECT_EARLY, [A, HOME], '23:30', 30),
  trip(HEADWAY_BUS, [A, HOME], '23:20', 30, 10),
  trip(TO_B, [A, B], '23:00', 10),
  trip(B_HOME, [B, HOME], '23:15', 20),
];

function journeyFromA(excludedRoutes?: ReadonlySet<number>) {
  const { graph } = buildTransitGraph({ stops: STOPS, trips: TRIPS, footpaths: [] });
  const index = indexGraph(graph);
  const home = index.stopIndexById.get(HOME)!;
  const result = reverseRaptor(graph, index, [{ stop: home, latestArrival: Infinity }], {
    ...OPTIONS,
    excludedRoutes,
  });
  const journey = reconstructJourney(graph, result, index.stopIndexById.get(A)!);
  const routes = journey?.legs.flatMap((leg) =>
    leg.kind === 'ride' ? [graph.patternRouteIds[leg.pattern]] : [],
  );
  return { journey, routes };
}

describe('reverseRaptor excludedRoutes', () => {
  it('rides the latest route when nothing is excluded', () => {
    const { journey, routes } = journeyFromA();
    expect(journey?.latestDeparture).toBe(m('23:50'));
    expect(routes).toEqual([DIRECT_LATE]);
  });

  it('skips excluded routes and finds the next latest one', () => {
    const { journey, routes } = journeyFromA(new Set([DIRECT_LATE]));
    expect(journey?.latestDeparture).toBe(m('23:30'));
    expect(routes).toEqual([DIRECT_EARLY]);
  });

  it('falls back to the headway bus, then to a transfer', () => {
    expect(journeyFromA(new Set([DIRECT_LATE, DIRECT_EARLY])).routes).toEqual([HEADWAY_BUS]);
    const { routes } = journeyFromA(new Set([DIRECT_LATE, DIRECT_EARLY, HEADWAY_BUS]));
    expect(routes).toEqual([TO_B, B_HOME]);
  });

  it('finds no journey when every route home is excluded', () => {
    const { journey } = journeyFromA(new Set([DIRECT_LATE, DIRECT_EARLY, HEADWAY_BUS, B_HOME]));
    expect(journey).toBeUndefined();
  });
});
