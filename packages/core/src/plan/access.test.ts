import { describe, expect, it } from 'vitest';
import { buildTransitGraph, type GraphTripInput } from '#graph/build-graph';
import { indexGraph } from '#graph/graph-index';
import { homeTargets, meetupDepartures, WALK_TIME_FACTORS } from '#plan/access';
import { reverseRaptor } from '#raptor/reverse-raptor';

// 약속 장소 근처 역(150m, 600m), 집 근처 역(300m), 집에서 먼 역(3km)
const MEETUP = { lat: 37.5, lng: 127.0 };
const HOME = { lat: 37.3, lng: 127.0 };
const METERS_PER_DEGREE_LAT = 111_320;
const north = (base: typeof MEETUP, meters: number) => ({
  lat: base.lat + meters / METERS_PER_DEGREE_LAT,
  lng: base.lng,
});

const STOPS = [
  { id: 1, name: '가까운역', ...north(MEETUP, 150) },
  { id: 2, name: '먼역', ...north(MEETUP, 600) },
  { id: 3, name: '집앞역', ...north(HOME, 300) },
  { id: 4, name: '집먼역', ...north(HOME, 3000) },
];

function trip(from: number, to: number, depart: number): GraphTripInput {
  return {
    routeId: from,
    routeName: `${from}`,
    mode: 'subway',
    label: '',
    headwayMinutes: null,
    stopTimes: [
      { stopId: from, arrival: depart, departure: depart, source: 'timetable', confidence: 'high' },
      {
        stopId: to,
        arrival: depart + 30,
        departure: depart + 30,
        source: 'timetable',
        confidence: 'high',
      },
    ],
  };
}

const OPTIONS = { maxWalkMinutes: 15, walkTimeFactor: WALK_TIME_FACTORS.normal };

describe('access', () => {
  const { graph } = buildTransitGraph({
    stops: STOPS,
    trips: [trip(1, 3, 1400), trip(2, 3, 1420), trip(1, 4, 1500)],
    footpaths: [],
  });
  const index = indexGraph(graph);

  it('targets only stops within reach of home', () => {
    const targets = homeTargets(graph, HOME, OPTIONS);
    expect(targets.map((t) => graph.stopIds[t.stop])).toEqual([3]);
    expect(targets[0]?.latestArrival).toBe(Infinity);
  });

  it('subtracts the walk and the safety margin at the meetup side', () => {
    const result = reverseRaptor(graph, index, homeTargets(graph, HOME, OPTIONS), {
      maxRides: 1,
      minTransferMinutes: 1,
      walkTimeFactor: 1,
    });
    const departures = meetupDepartures(graph, result, MEETUP, {
      ...OPTIONS,
      safetyMarginMinutes: 5,
    });
    // 먼역 1420 − 도보(600m × 1.3 ÷ 4.5km/h = 10.4분) − 5 = 1404.6
    expect(graph.stopIds[departures[0]!.stop]).toBe(2);
    expect(departures[0]!.latestDeparture).toBeCloseTo(1404.6, 1);
    expect(departures).toHaveLength(2);
  });
});
