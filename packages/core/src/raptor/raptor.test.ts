import { describe, expect, it } from 'vitest';
import {
  buildTransitGraph,
  type GraphFootpathInput,
  type GraphTripInput,
} from '#graph/build-graph';
import { indexGraph } from '#graph/graph-index';
import { patternStopsBetween } from '#graph/transit-graph';
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

const OPTIONS: ReverseRaptorOptions = { maxRides: 3, minTransferMinutes: 1, walkTimeFactor: 1 };

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

describe('reverseRaptor headway segments', () => {
  // 버스 9: X → C 막차 23:00 (구간 10분), 배차 15분. C에서 HOME 막차 22:35.
  const bus = trip(9, [X, C], '23:00', 10, 15);

  it('uses the worst wait before the last run when the last run is too late', () => {
    const journey = search([...BASE_TRIPS.slice(3), bus]).journeyFrom(X);
    // C 내림 한계 22:34 − 탑승 10분 − 배차 15분 = 22:09
    expect(journey?.latestDeparture).toBe(m('22:09'));
    const first = journey?.legs[0];
    expect(first?.kind === 'ride' && first.headwayMinutes).toBe(15);
    expect(first?.kind === 'ride' && [first.depart, first.arrive]).toEqual([
      m('22:24'),
      m('22:34'),
    ]);
    expect(journey?.rides).toBe(2);
  });

  it('takes the last run itself when it arrives in time', () => {
    const late = trip(2, LINE_2, '23:30', 15);
    const journey = search([late, bus]).journeyFrom(X);
    expect(journey?.latestDeparture).toBe(m('23:00'));
    const first = journey?.legs[0];
    expect(first?.kind === 'ride' && first.headwayMinutes).toBeNull();
  });
});

describe('walk time factor', () => {
  it('scales footpath minutes', () => {
    const trips = [...BASE_TRIPS, trip(3, [X, D], '22:21', 10)];
    const footpaths = [{ fromStopId: D, toStopId: C, walkSeconds: 240 }];
    // 걷기 4분이면 22:31, 느림(× 1.25) 5분이면 22:30
    expect(search(trips, footpaths).journeyFrom(D)?.latestDeparture).toBe(m('22:31'));
    const slow = search(trips, footpaths, { ...OPTIONS, walkTimeFactor: 1.25 });
    expect(slow.journeyFrom(D)?.latestDeparture).toBe(m('22:30'));
  });
});

describe('buildTransitGraph', () => {
  it('keeps the input stop order and makes times non-decreasing', () => {
    const input = trip(10, [A, B, C], '22:00', 10);
    const swapped = {
      ...input,
      stopTimes: input.stopTimes.map((st, i) =>
        i === 1 ? { ...st, arrival: m('21:50'), departure: m('21:50') } : st,
      ),
    };
    const { graph } = buildTransitGraph({ stops: STOPS, trips: [swapped], footpaths: [] });
    expect(Array.from(graph.patternStops)).toEqual([0, 1, 2]);
    expect(Array.from(graph.departures)).toEqual([m('22:00'), m('22:00'), m('22:20')]);
  });

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

describe('patternStopsBetween', () => {
  const loop = buildTransitGraph({
    stops: STOPS,
    trips: [
      {
        routeId: 1,
        routeName: '순환',
        mode: 'bus',
        label: '',
        headwayMinutes: null,
        stopTimes: [A, B, C, A, D].map((stopId, i) => ({
          stopId,
          arrival: 1300 + i * 5,
          departure: 1300 + i * 5,
          source: 'seoul_api' as const,
          confidence: 'high' as const,
        })),
      },
    ],
    footpaths: [],
  }).graph;
  const at = (id: number) => indexGraph(loop).stopIndexById.get(id)!;
  const ids = (stops: number[]) => stops.map((s) => loop.stopIds[s]);

  it('lists every stop from boarding to alighting', () => {
    expect(ids(patternStopsBetween(loop, 0, at(A), at(C)))).toEqual([A, B, C]);
  });

  it('uses the shortest span when the boarding stop appears twice', () => {
    expect(ids(patternStopsBetween(loop, 0, at(A), at(D)))).toEqual([A, D]);
  });

  it('falls back to the two ends when the stops are not on the pattern', () => {
    expect(ids(patternStopsBetween(loop, 0, at(D), at(A)))).toEqual([D, A]);
  });
});
