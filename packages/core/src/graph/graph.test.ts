import { describe, expect, it } from 'vitest';
import { buildTransitGraph, type GraphTripInput } from '#graph/build-graph';
import { indexGraph } from '#graph/graph-index';
import { patternStopsBetween } from '#graph/transit-graph';
import { toServiceMinutes } from '#time/service-day';

const A = 1;
const B = 2;
const C = 3;
const D = 4;
const HOME = 5;
const STOP_IDS = [A, B, C, D, HOME];
const STOPS = STOP_IDS.map((id) => ({ id, name: `S${id}`, lat: null, lng: null }));

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
): GraphTripInput {
  return {
    routeId,
    routeName: `L${routeId}`,
    mode: 'subway',
    label: `${routeId}@${start}`,
    headwayMinutes: null,
    stopTimes: stops.map((stopId, i) => {
      const time = m(start) + i * gapMinutes;
      return { stopId, arrival: time, departure: time, source: 'timetable', confidence: 'high' };
    }),
  };
}

describe('buildTransitGraph', () => {
  it('pulls boarding times earlier and pushes alighting times later when times go backward', () => {
    const input = trip(10, [A, B, C], '22:00', 10);
    const swapped = {
      ...input,
      stopTimes: input.stopTimes.map((st, i) =>
        i === 1 ? { ...st, arrival: m('21:50'), departure: m('21:50') } : st,
      ),
    };
    const { graph, adjustedStopTimes, adjustedStopTimesByRoute } = buildTransitGraph({
      stops: STOPS,
      trips: [swapped],
      footpaths: [],
    });
    expect(Array.from(graph.patternStops)).toEqual([0, 1, 2]);
    expect(Array.from(graph.departures)).toEqual([m('21:50'), m('21:50'), m('22:20')]);
    expect(Array.from(graph.arrivals)).toEqual([m('22:00'), m('22:00'), m('22:20')]);
    expect(adjustedStopTimes).toBe(2);
    expect(adjustedStopTimesByRoute.get(10)).toBe(2);
  });

  it('spreads a segment that is too short for its distance by the minimum travel time', () => {
    // 위도 0.27도 ≈ 30km → 80km/h로 22.5분, 반올림 여유 1분을 빼면 최소 21.5분
    const far = [
      { id: A, name: 'A', lat: 37, lng: 127 },
      { id: B, name: 'B', lat: 37.27, lng: 127 },
    ];
    const instant = { ...trip(11, [A, B], '23:00', 0), mode: 'bus' as const };
    const { graph } = buildTransitGraph({ stops: far, trips: [instant], footpaths: [] });
    const [departA, departB] = Array.from(graph.departures);
    const [arriveA, arriveB] = Array.from(graph.arrivals);
    expect(departB).toBe(m('23:00'));
    expect(departB! - departA!).toBeCloseTo(21.5, 0);
    expect(arriveA).toBe(m('23:00'));
    expect(arriveB! - arriveA!).toBeCloseTo(21.5, 0);
  });

  it('leaves a consistent subway timetable unchanged', () => {
    const near = [
      { id: A, name: 'A', lat: 37.5, lng: 127 },
      { id: B, name: 'B', lat: 37.51, lng: 127 },
      { id: C, name: 'C', lat: 37.52, lng: 127 },
    ];
    const subway: GraphTripInput = {
      ...trip(12, [A, B, C], '23:00', 2),
      stopTimes: [
        {
          stopId: A,
          arrival: m('23:00'),
          departure: m('23:00') + 0.5,
          source: 'timetable',
          confidence: 'high',
        },
        {
          stopId: B,
          arrival: m('23:02'),
          departure: m('23:02') + 0.5,
          source: 'timetable',
          confidence: 'high',
        },
        {
          stopId: C,
          arrival: m('23:04'),
          departure: m('23:04') + 0.5,
          source: 'timetable',
          confidence: 'high',
        },
      ],
    };
    const { graph, adjustedStopTimes } = buildTransitGraph({
      stops: near,
      trips: [subway],
      footpaths: [],
    });
    expect(Array.from(graph.arrivals)).toEqual(subway.stopTimes.map((st) => st.arrival));
    expect(Array.from(graph.departures)).toEqual(subway.stopTimes.map((st) => st.departure));
    expect(adjustedStopTimes).toBe(0);
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
