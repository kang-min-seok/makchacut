import { describe, expect, it } from 'vitest';
import { distanceMeters } from '#geo/distance';
import { nearbyPairs } from '#geo/nearby-pairs';
import { buildFootpaths, transferSecondsAt, walkSecondsFor } from '#stops/footpaths';
import { planStopMerges } from '#stops/merge-stops';

// 위도 1e-4도 ≈ 11.1m
const PANGYO = { lat: 37.3948, lng: 127.1112 };
const north = (meters: number) => ({ lat: PANGYO.lat + meters / 111_320, lng: PANGYO.lng });

describe('planStopMerges', () => {
  it('merges same stop number within 30m into the smallest stop id', () => {
    const merges = planStopMerges([
      { stopId: 10, name: '판교역', ...north(0), stopNo: '07489' },
      { stopId: 4, name: '판교역.낙생육교', ...north(20), stopNo: '07489' },
      { stopId: 7, name: '판교역', ...north(25), stopNo: ' 07489 ' },
    ]);
    expect([...merges]).toEqual([
      [10, 4],
      [7, 4],
    ]);
  });

  it('ignores leading zeros of stop numbers (모란역 6346/06346)', () => {
    const merges = planStopMerges([
      { stopId: 5, name: '모란역', ...north(0), stopNo: '06346' },
      { stopId: 3, name: '모란역.모란시장', ...north(10), stopNo: '6346' },
      { stopId: 8, name: '모란역', ...north(15), stopNo: '6347' },
    ]);
    expect([...merges]).toEqual([[5, 3]]);
  });

  it('keeps stops apart when far away or numbered differently', () => {
    const merges = planStopMerges([
      { stopId: 1, name: '강남역', ...north(0), stopNo: '22009' },
      { stopId: 2, name: '강남역', ...north(40), stopNo: '22009' },
      { stopId: 3, name: '강남역', ...north(5), stopNo: '22010' },
    ]);
    expect(merges.size).toBe(0);
  });

  it('falls back to the same name when GBIS has no number for a Seoul stop', () => {
    const merges = planStopMerges([
      { stopId: 963, name: '명동입구B', ...north(0), stopNo: '02143' },
      { stopId: 764, name: '명동입구B', ...north(3), stopNo: null },
      { stopId: 757, name: '서울시청', ...north(10), stopNo: null },
      { stopId: 961, name: '숭례문교차로(미정차)', ...north(1), stopNo: null },
      { stopId: 762, name: '숭례문교차로(미정차)', ...north(2), stopNo: null },
      { stopId: 900, name: '국가인권위', ...north(500), stopNo: '02002' },
      { stopId: 800, name: '국가인권위(중)', ...north(504), stopNo: null },
    ]);
    expect([...merges]).toEqual([
      [963, 764],
      [900, 800],
    ]);
  });

  it('is stable on rerun (already merged sources share a stop id)', () => {
    const merges = planStopMerges([
      { stopId: 4, name: '판교역', ...north(0), stopNo: '07489' },
      { stopId: 4, name: '판교역', ...north(20), stopNo: '07489' },
    ]);
    expect(merges.size).toBe(0);
  });
});

describe('nearbyPairs', () => {
  it('finds both directions within the radius only', () => {
    const pairs = nearbyPairs(
      [
        { id: 1, ...north(0) },
        { id: 2, ...north(390) },
        { id: 3, ...north(810) },
      ],
      400,
    );
    expect(pairs.map((p) => [p.fromId, p.toId])).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(distanceMeters(north(0), north(390))).toBeCloseTo(390, 0);
  });
});

describe('buildFootpaths', () => {
  it('walks straight distance × 1.3 at 4.5km/h', () => {
    // 300m × 1.3 = 390m ÷ 1.25m/s = 312초
    expect(walkSecondsFor(300)).toBe(312);
  });

  it('links nearby stops and same-name stations on other lines', () => {
    const paths = buildFootpaths([
      { id: 1, mode: 'bus', name: '판교역동편', ...north(0) },
      { id: 2, mode: 'bus', name: '판교역', ...north(300) },
      { id: 3, mode: 'subway', name: '고속터미널', lat: null, lng: null },
      { id: 4, mode: 'subway', name: '고속터미널', ...north(0) },
      { id: 5, mode: 'subway', name: '모란', ...north(5_000) },
      { id: 6, mode: 'subway', name: '모란', lat: null, lng: null },
    ]);
    const find = (from: number, to: number) =>
      paths.find((p) => p.fromStopId === from && p.toStopId === to)?.walkSeconds;
    expect(find(1, 2)).toBe(312);
    expect(find(2, 1)).toBe(312);
    expect(find(3, 4)).toBe(transferSecondsAt('고속터미널'));
    expect(find(5, 6)).toBe(180);
    // 같은 좌표의 다른 이름 버스 정류장 ↔ 역은 거리로 잇는다
    expect(find(1, 4)).toBe(0);
  });
});
