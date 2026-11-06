import { describe, expect, it } from 'vitest';
import { usableBusStopLast } from '#graph/bus-last-rules';
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
    routeSource: 'gbis',
    hasDaySchedule: true,
  };
}

describe('busLastRunTrips', () => {
  it('splits at the turn stop and starts the inbound run there', () => {
    // 회차 전 막차가 회차점(seq 2)에 00:10 닿아도 회차 후 막차 시각은 그대로
    const trips = busLastRunTrips([
      row(3, 'inbound', 1450),
      row(1, 'outbound', 1430),
      row(2, 'outbound', 1435),
    ]);
    expect(trips.map((t) => t.stopTimes.map((s) => s.stopId))).toEqual([
      [101, 102],
      [102, 103],
    ]);
    expect(trips[1]?.stopTimes.map((s) => s.departure)).toEqual([1435, 1450]);
    expect(trips[0]?.headwayMinutes).toBe(20);
  });

  it('moves estimated last runs earlier by confidence', () => {
    const [trip] = busLastRunTrips([
      { ...row(1, 'outbound', 1400), confidence: 'low' },
      { ...row(2, 'outbound', 1420), confidence: 'medium' },
    ]);
    expect(trip?.stopTimes.map((s) => s.departure)).toEqual([1390, 1415]);
  });

  it('keeps one-way routes as a single run', () => {
    const trips = busLastRunTrips([row(1, 'outbound', 1400), row(2, 'outbound', 1410)]);
    expect(trips).toHaveLength(1);
  });
});

describe('usableBusStopLast', () => {
  it('drops late-night values of non-night routes and borrowed Seoul days', () => {
    const rows = [
      row(1, 'outbound', 1610),
      { ...row(1, 'outbound', 1610), routeName: 'N61' },
      { ...row(2, 'outbound', 1400), routeSource: 'seoul_bus' as const, hasDaySchedule: false },
      row(3, 'outbound', 1500),
    ];
    expect(usableBusStopLast(rows).map((r) => [r.routeName, r.seq])).toEqual([
      ['N61', 1],
      ['6003', 3],
    ]);
  });
});
