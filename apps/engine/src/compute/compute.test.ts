import { describe, expect, it } from 'vitest';
import { buildStopLast } from '#compute/build-stop-last';
import { distanceFallbackWarning, rowChangeWarning } from '#compute/change-warning';
import { pgArray } from '#compute/stores/pg-array';
import type { LoadedRouteStop } from '#compute/stores/stop-last-store';

const routeStop = (
  routeId: number,
  seq: number,
  stopId: number,
  segmentSeconds: number | null,
): LoadedRouteStop => ({
  routeId,
  seq,
  stopId,
  direction: 'outbound',
  name: `정류장${stopId}`,
  lat: null,
  lng: null,
  segmentSeconds,
  segmentMeters: null,
});

describe('buildStopLast', () => {
  // 1: 경기 4108, 2: 같은 노선의 서울 쪽(busRouteId = GBIS routeId), 3: 서울 전용 노선
  const inputs = {
    routes: [
      { routeId: 1, source: 'gbis' as const, sourceRouteId: '233000270' },
      { routeId: 2, source: 'seoul_bus' as const, sourceRouteId: '233000270' },
      { routeId: 3, source: 'seoul_bus' as const, sourceRouteId: '100100001' },
    ],
    routeStops: [
      routeStop(1, 1, 100, 0),
      routeStop(1, 2, 101, 600),
      routeStop(2, 1, 100, null),
      routeStop(2, 2, 101, null),
      routeStop(3, 1, 200, null),
    ],
    schedules: [
      { routeId: 1, dayType: 'weekday' as const, lastAtOrigin: 1360, lastAtTurn: null },
      { routeId: 3, dayType: 'weekday' as const, lastAtOrigin: 1400, lastAtTurn: null },
    ],
    observations: [{ routeId: 2, seq: 2, dayType: 'weekday' as const, lastMinutes: 1375 }],
  };

  it('puts Seoul values onto the GBIS route and skips the duplicate Seoul route', () => {
    const build = buildStopLast(inputs);
    expect(build.seoulRoutesMergedIntoGbis).toBe(1);
    expect(build.rows.some((row) => row.routeId === 2)).toBe(false);
    expect(build.rows.find((r) => r.routeId === 1 && r.seq === 2)).toMatchObject({
      dayType: 'weekday',
      lastMinutes: 1375,
      source: 'seoul_api',
    });
    expect(build.rows.filter((r) => r.routeId === 3)).toHaveLength(4);
    expect(build.gbisRoutes).toBe(1);
    expect(build.distanceRoutes).toBe(0);
  });
});

describe('warnings', () => {
  it('flags large shrink or growth but not the first fill', () => {
    expect(rowChangeWarning('footpath', 0, 1000)).toBeUndefined();
    expect(rowChangeWarning('footpath', 1000, 950)).toBeUndefined();
    expect(rowChangeWarning('footpath', 1000, 800)).toContain('-20%');
    expect(rowChangeWarning('footpath', 1000, 1600)).toContain('+60%');
  });

  it('flags a rising ptts fallback ratio', () => {
    expect(distanceFallbackWarning(1, 10)).toBeUndefined();
    expect(distanceFallbackWarning(3, 10)).toContain('30%');
  });
});

describe('pgArray', () => {
  it('writes a Postgres array literal', () => {
    expect(pgArray([1, null, 2.5])).toBe('{1,NULL,2.5}');
    expect(pgArray(['weekday', 'sat'])).toBe('{weekday,sat}');
  });
});
