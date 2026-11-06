import { describe, expect, it } from 'vitest';
import {
  buildTransitGraph,
  type GraphFootpathInput,
  type GraphTripInput,
} from '#graph/build-graph';
import { indexGraph } from '#graph/graph-index';
import { reconstructJourney } from '#raptor/journey';
import { reverseRaptor, type ReverseRaptorOptions } from '#raptor/reverse-raptor';
import { toServiceMinutes } from '#time/service-day';

// 가상 노선망 (정류장 id)
const A = 1;
const B = 2;
const C = 3;
const D = 4;
const HOME = 5;
const X = 6;
const P = 7;
const Q = 8;
const STOP_IDS = [A, B, C, D, HOME, X, P, Q];
const STOPS = STOP_IDS.map((id) => ({ id, name: `S${id}`, lat: null, lng: null }));

const OPTIONS: ReverseRaptorOptions = { maxRides: 3, minTransferMinutes: 1 };

function m(clock: string): number {
  const minutes = toServiceMinutes(clock);
  if (minutes === undefined) throw new Error(clock);
  return minutes;
}

// 정류장마다 간격(분)만큼 뒤에 도착·출발하는 운행
function trip(
  routeId: number,
  stops: readonly number[],
  start: string,
  gapMinutes: number,
  label = `${routeId}@${start}`,
): GraphTripInput {
  return {
    routeId,
    routeName: `L${routeId}`,
    mode: 'subway',
    label,
    stopTimes: stops.map((stopId, i) => {
      const time = m(start) + i * gapMinutes;
      return { stopId, arrival: time, departure: time };
    }),
  };
}

function search(trips: GraphTripInput[], footpaths: GraphFootpathInput[] = [], options = OPTIONS) {
  const { graph } = buildTransitGraph({ stops: STOPS, trips, footpaths });
  const index = indexGraph(graph);
  const home = index.stopIndexById.get(HOME)!;
  const result = reverseRaptor(graph, index, [{ stop: home, latestArrival: Infinity }], options);
  const journeyFrom = (stopId: number) =>
    reconstructJourney(graph, result, index.stopIndexById.get(stopId)!);
  return { graph, journeyFrom };
}

const LINE_1 = [A, B, C];
const LINE_2 = [C, HOME];
const BASE_TRIPS = [
  trip(1, LINE_1, '22:00', 10),
  trip(1, LINE_1, '22:10', 10),
  trip(1, LINE_1, '22:20', 10),
  trip(2, LINE_2, '22:25', 15),
  trip(2, LINE_2, '22:35', 15),
];

describe('reverseRaptor', () => {
  it('finds the latest departure through a transfer', () => {
    const { journeyFrom } = search(BASE_TRIPS);
    expect(journeyFrom(C)?.latestDeparture).toBe(m('22:35'));
    // 22:10 열차가 C에 22:30 도착 → 22:35 막차
    expect(journeyFrom(A)?.latestDeparture).toBe(m('22:10'));
    expect(journeyFrom(B)?.latestDeparture).toBe(m('22:20'));
    expect(journeyFrom(A)?.rides).toBe(2);
  });

  it('applies the minimum transfer slack at the same stop', () => {
    const trips = [...BASE_TRIPS.slice(0, 3), trip(2, LINE_2, '22:30', 15)];
    // 22:10 열차는 C에 22:30 도착 — 22:30 출발 막차에는 1분 여유가 없다
    expect(search(trips).journeyFrom(A)?.latestDeparture).toBe(m('22:00'));
    const noSlack = search(trips, [], { ...OPTIONS, minTransferMinutes: 0 });
    expect(noSlack.journeyFrom(A)?.latestDeparture).toBe(m('22:10'));
  });

  it('walks between nearby stops without the extra slack', () => {
    const trips = [...BASE_TRIPS, trip(3, [X, D], '22:21', 10)];
    const footpaths = [
      { fromStopId: D, toStopId: C, walkSeconds: 120 },
      { fromStopId: C, toStopId: D, walkSeconds: 120 },
    ];
    const journey = search(trips, footpaths).journeyFrom(X);
    // D 22:31 도착 → 2분 걸어 C 22:33 → 22:35 막차
    expect(journey?.latestDeparture).toBe(m('22:21'));
    expect(journey?.legs.map((l) => l.kind)).toEqual(['ride', 'walk', 'ride']);
    expect(journey?.targetStop).toBeDefined();
  });

  it('ignores a later trip that does not reach the stop (short turn)', () => {
    const trips = [trip(4, [P, Q, HOME], '22:00', 10), trip(4, [P, Q], '22:30', 10)];
    expect(search(trips).journeyFrom(P)?.latestDeparture).toBe(m('22:00'));
  });

  it('handles times past midnight', () => {
    const trips = [trip(2, LINE_2, '23:50', 15), trip(2, LINE_2, '00:20', 15)];
    expect(search(trips).journeyFrom(C)?.latestDeparture).toBe(m('00:20'));
  });

  it('limits the number of rides', () => {
    const { journeyFrom } = search(BASE_TRIPS, [], { ...OPTIONS, maxRides: 1 });
    expect(journeyFrom(C)?.latestDeparture).toBe(m('22:35'));
    expect(journeyFrom(A)).toBeUndefined();
  });

  it('reconstructs ride legs with times', () => {
    const journey = search(BASE_TRIPS).journeyFrom(A);
    const rides = journey?.legs.filter((l) => l.kind === 'ride');
    expect(rides?.map((l) => [l.depart, l.arrive])).toEqual([
      [m('22:10'), m('22:30')],
      [m('22:35'), m('22:50')],
    ]);
  });

  it('boards a stop that appears twice on a loop line at either position', () => {
    // A → B → C → A 순환: 두 번째 A에서 내려 HOME으로 가는 노선
    const trips = [trip(5, [A, B, C, A], '22:00', 10), trip(6, [A, HOME], '22:40', 5)];
    expect(search(trips).journeyFrom(B)?.latestDeparture).toBe(m('22:10'));
  });
});

describe('buildTransitGraph', () => {
  it('splits trips that overtake into separate patterns', () => {
    const slow = trip(7, [A, B, C], '22:00', 20);
    const fast = trip(7, [A, B, C], '22:05', 5);
    const { graph } = buildTransitGraph({ stops: STOPS, trips: [slow, fast], footpaths: [] });
    expect(graph.patternRouteIds.length).toBe(2);
  });

  it('drops unknown stops and trips with fewer than two stops', () => {
    const report = buildTransitGraph({
      stops: STOPS,
      trips: [trip(8, [A, 999], '22:00', 5), trip(8, [A, B], '22:00', 5)],
      footpaths: [{ fromStopId: A, toStopId: HOME, walkSeconds: 60 }],
    });
    expect(report.skippedTrips).toBe(1);
    expect(report.droppedStopTimes).toBe(1);
    // HOME은 어느 운행도 지나지 않아 그래프에 없다 → 도보 간선도 빠진다
    expect(report.graph.footpathFrom.length).toBe(0);
  });
});
