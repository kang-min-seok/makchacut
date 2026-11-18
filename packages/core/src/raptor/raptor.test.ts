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
// 집 진입점: 이름의 숫자 = 집까지 도보(분)
const E2 = 9;
const E7 = 10;
const E15 = 11;
const STOP_IDS = [A, B, C, D, HOME, X, P, Q, E2, E7, E15];
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

type HomeEntry = { stopId: number; walkMinutes: number };

function search(
  trips: GraphTripInput[],
  footpaths: GraphFootpathInput[] = [],
  options = OPTIONS,
  entries: readonly HomeEntry[] = [{ stopId: HOME, walkMinutes: 0 }],
) {
  const { graph } = buildTransitGraph({ stops: STOPS, trips, footpaths });
  const index = indexGraph(graph);
  const stop = (stopId: number) => index.stopIndexById.get(stopId)!;
  const targets = entries.map((e) => ({
    stop: stop(e.stopId),
    latestArrival: Infinity,
    finishMinutes: e.walkMinutes,
  }));
  const result = reverseRaptor(graph, index, targets, options);
  const journeyFrom = (stopId: number) => reconstructJourney(graph, result, stop(stopId));
  return { graph, journeyFrom, stop };
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

describe('home entries', () => {
  const ENTRIES = [
    { stopId: E7, walkMinutes: 7 },
    { stopId: E2, walkMinutes: 2 },
    { stopId: E15, walkMinutes: 15 },
  ];
  // 먼 진입점이 먼저 처리되게 (먼저 찾은 값을 유지하면 먼 쪽이 남는다)
  const FAR_FIRST = [...ENTRIES].reverse();
  const ENTRY_WALK_SECONDS = 60;
  // 진입점끼리는 서로 걸어서 1분
  const ENTRY_FOOTPATHS = ENTRIES.flatMap((from) =>
    ENTRIES.filter((to) => to !== from).map((to) => ({
      fromStopId: from.stopId,
      toStopId: to.stopId,
      walkSeconds: ENTRY_WALK_SECONDS,
    })),
  );

  it('alights where the arrival plus the walk home is earliest', () => {
    // E7 23:03(+7) → E2 23:06(+2) → E15 23:09(+15): E2에서 내리면 23:08 도착
    const trips = [trip(10, [A, E7, E2, E15], '23:00', 3)];
    const { journeyFrom, stop } = search(trips, ENTRY_FOOTPATHS, OPTIONS, ENTRIES);
    expect(journeyFrom(A)?.targetStop).toBe(stop(E2));
  });

  it('walks on from the entry it alights at when that reaches home first', () => {
    // E7 23:03에 내려 E2로 1분 걸으면 23:04(+2) = 23:06 — E2에서 내리는 23:08보다 이르다
    const trips = [trip(10, [A, E7, E2, E15], '23:00', 3)];
    const journey = search(trips, ENTRY_FOOTPATHS, OPTIONS, ENTRIES).journeyFrom(A);
    expect(journey?.legs.map((leg) => leg.kind)).toEqual(['ride', 'walk']);
    expect(journey?.legs[1]).toMatchObject({ fromStop: journey?.legs[0]?.toStop });
  });

  it('takes the route that reaches home first when both leave at the same time', () => {
    // 둘 다 A 23:00 출발: E15 23:10(+15) = 23:25, E2 23:20(+2) = 23:22
    const trips = [trip(11, [A, E2], '23:00', 20), trip(12, [A, E15], '23:00', 10)];
    const { journeyFrom, stop } = search(trips, [], OPTIONS, FAR_FIRST);
    expect(journeyFrom(A)?.latestDeparture).toBe(m('23:00'));
    expect(journeyFrom(A)?.targetStop).toBe(stop(E2));
  });

  it('walks to the entry that reaches home first', () => {
    // X에서 E15는 1분, E2는 3분 — E2로 걸으면 집에 2분 먼저 닿는다 (05:00 운행은 진입점을 그래프에 올리는 용도)
    const trips = [trip(13, [A, X], '23:00', 10), trip(17, [E2, E15], '05:00', 1)];
    const footpaths = [
      { fromStopId: X, toStopId: E15, walkSeconds: 60 },
      { fromStopId: X, toStopId: E2, walkSeconds: 180 },
    ];
    const { journeyFrom, stop } = search(trips, footpaths, OPTIONS, FAR_FIRST);
    expect(journeyFrom(A)?.targetStop).toBe(stop(E2));
  });

  it('keeps the route with fewer rides on the same departure', () => {
    // 한 번 타면 23:30(+15) = 23:45, 갈아타면 23:15(+2) = 23:17이지만 덜 타는 쪽이 우선
    const trips = [
      trip(14, [A, E15], '23:00', 30),
      trip(15, [A, B], '23:00', 5),
      trip(16, [B, E2], '23:10', 5),
    ];
    const journey = search(trips, [], OPTIONS, ENTRIES).journeyFrom(A);
    expect(journey?.latestDeparture).toBe(m('23:00'));
    expect(journey?.rides).toBe(1);
  });
});

describe('continuation after alighting', () => {
  it('alights where the reconstructed route reaches home first', () => {
    // C에 23:28에 내리면 바로 C 23:30 차(집 24:00)도 탈 수 있지만 D로 걸어 23:31 차(집 23:40)가 이르다.
    // X에 내리면 23:30 차로 집 23:45 — 탐색과 복원 모두 C에 내려 D로 걷는 쪽을 골라야 한다
    const trips = [
      trip(20, [C, HOME], '23:30', 30),
      trip(21, [D, HOME], '23:31', 9),
      trip(22, [X, HOME], '23:30', 15),
      trip(23, [A, C, X], '23:27', 1),
    ];
    const footpaths = [{ fromStopId: C, toStopId: D, walkSeconds: 60 }];
    const { journeyFrom, stop } = search(trips, footpaths);
    const journey = journeyFrom(A);
    expect(journey?.legs.map((leg) => leg.kind)).toEqual(['ride', 'walk', 'ride']);
    expect(journey?.legs[0]).toMatchObject({ toStop: stop(C) });
    expect(journey?.legs[2]).toMatchObject({ fromStop: stop(D), arrive: m('23:40') });
  });
});
