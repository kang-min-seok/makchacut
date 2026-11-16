import { describe, expect, it } from 'vitest';
import { buildTransitGraph, indexGraph, reconstructJourney, reverseRaptor } from '@makchacut/core';
import { type BusStopLastRow, busLastRunTrips } from '#graph/bus-trips';

function row(
  seq: number,
  direction: BusStopLastRow['direction'],
  lastMinutes: number,
): BusStopLastRow {
  return {
    routeId: 1,
    routeName: '6003',
    seq,
    stopId: 100 + seq,
    direction,
    lastMinutes,
    source: 'gbis_eta',
    confidence: 'high',
    headwayMinutes: 20,
  };
}

describe('busLastRunTrips', () => {
  it('keeps a run that continues through the turn stop as one trip', () => {
    // 1551: 회차 전 막차가 회차점(seq 2)을 지나 그대로 회차 후 정류장으로 간다
    const trips = busLastRunTrips([
      row(3, 'inbound', 1450),
      row(1, 'outbound', 1430),
      row(2, 'outbound', 1435),
    ]);
    expect(trips.map((t) => t.stopTimes.map((s) => [s.stopId, s.departure]))).toEqual([
      [
        [101, 1430],
        [102, 1435],
        [103, 1450],
      ],
    ]);
    expect(trips[0]?.headwayMinutes).toBe(20);
  });

  it('compares raw last times before the confidence margin', () => {
    // 여유를 빼면 회차점(1435-10)이 회차 전(1430)보다 이르지만 원래 막차는 이어진다
    const trips = busLastRunTrips([
      row(1, 'outbound', 1430),
      { ...row(2, 'outbound', 1435), confidence: 'low' },
      row(3, 'inbound', 1450),
    ]);
    expect(trips).toHaveLength(1);
  });

  it('splits at the turn stop when an earlier stop is later than the turn', () => {
    // seq 1(20:40)이 회차점(20:30)보다 늦다 — 회차 전 막차는 회차점을 지나 계속 가는 차가 아니다
    const trips = busLastRunTrips([
      row(1, 'outbound', 1240),
      row(2, 'outbound', 1220),
      row(3, 'outbound', 1230),
      row(4, 'inbound', 1240),
    ]);
    expect(trips.map((t) => t.stopTimes.map((s) => s.stopId))).toEqual([
      [101, 102, 103],
      [103, 104],
    ]);
    expect(trips[1]?.stopTimes.map((s) => s.departure)).toEqual([1230, 1240]);
  });

  it('moves estimated last runs earlier by confidence', () => {
    const [trip] = busLastRunTrips([
      { ...row(1, 'outbound', 1400), confidence: 'low' },
      { ...row(2, 'outbound', 1420), confidence: 'medium' },
    ]);
    expect(trip?.stopTimes.map((s) => s.departure)).toEqual([1390, 1415]);
  });

  // 1336: 양쪽 기점 막차가 같은 시각이라 회차 전 직전 정류장(20:30)이 회차점 막차(20:00)보다 늦다
  it('leaves the turn stop out of the outbound run when the turn departs separately', () => {
    const trips = busLastRunTrips([
      row(1, 'outbound', 1200),
      row(2, 'outbound', 1230),
      row(3, 'outbound', 1200),
      row(4, 'inbound', 1210),
    ]);
    expect(trips.map((t) => t.stopTimes.map((s) => [s.stopId, s.departure]))).toEqual([
      [
        [101, 1200],
        [102, 1230],
      ],
      [
        [103, 1200],
        [104, 1210],
      ],
    ]);
  });

  it('keeps one-way routes as a single run', () => {
    const trips = busLastRunTrips([row(1, 'outbound', 1400), row(2, 'outbound', 1410)]);
    expect(trips).toHaveLength(1);
  });
});

describe('busLastRunTrips in the search', () => {
  // 가상 노선망: 1(회차 전) → 2(회차점) → 3(회차 후, 집)
  const STOPS = [101, 102, 103].map((id) => ({ id, name: `S${id}`, lat: null, lng: null }));

  it('rides through the turn stop in one boarding at the stop last time', () => {
    const trips = busLastRunTrips([
      row(1, 'outbound', 1430),
      row(2, 'outbound', 1435),
      row(3, 'inbound', 1450),
    ]);
    const { graph } = buildTransitGraph({ stops: STOPS, trips, footpaths: [] });
    const index = indexGraph(graph);
    const result = reverseRaptor(
      graph,
      index,
      [{ stop: index.stopIndexById.get(103)!, latestArrival: Infinity }],
      { maxRides: 3, minTransferMinutes: 1, walkTimeFactor: 1 },
    );
    const journey = reconstructJourney(graph, result, index.stopIndexById.get(101)!);
    expect(journey?.latestDeparture).toBe(1430);
    expect(journey?.rides).toBe(1);
  });
});
