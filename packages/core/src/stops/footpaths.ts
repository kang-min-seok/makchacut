import { hasCoordinates } from '#geo/distance';
import { nearbyPairs } from '#geo/nearby-pairs';

export type FootpathStop = {
  id: number;
  mode: 'bus' | 'subway';
  name: string;
  lat: number | null;
  lng: number | null;
};

export type Footpath = {
  fromStopId: number;
  toStopId: number;
  walkSeconds: number;
};

export const FOOTPATH_RADIUS_METERS = 400;
// 직선거리를 실제 보행 거리로 늘리는 계수
const DETOUR_FACTOR = 1.3;
const WALK_SPEED_KMH = 4.5;
const METERS_PER_KM = 1000;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
// 같은 역 다른 호선 환승 기본값
const DEFAULT_TRANSFER_MINUTES = 3;

// 환승 통로가 긴 역 수작업 보정(분). 역 이름(서울교통공사 역 목록 표기) 기준으로 그 역의 모든 호선 쌍에 쓴다.
// 대략값이다 — 정확도 피드백(M3)으로 다듬는다.
export const TRANSFER_MINUTES_BY_STATION: Readonly<Record<string, number>> = {
  고속터미널: 6,
  종로3가: 6,
  동대문역사문화공원: 5,
  김포공항: 7,
  서울역: 7,
  노원: 6,
  신도림: 4,
  왕십리: 5,
  사당: 5,
  교대: 4,
  충무로: 4,
  공덕: 5,
  군자: 4,
  디지털미디어시티: 6,
};

export function walkSecondsFor(meters: number): number {
  const walkMeters = meters * DETOUR_FACTOR;
  return Math.ceil((walkMeters / METERS_PER_KM / WALK_SPEED_KMH) * SECONDS_PER_HOUR);
}

export function transferSecondsAt(stationName: string): number {
  return (
    (TRANSFER_MINUTES_BY_STATION[stationName] ?? DEFAULT_TRANSFER_MINUTES) * SECONDS_PER_MINUTE
  );
}

const pairKey = (from: number, to: number) => `${from}:${to}`;

// 반경 400m 안의 정류장·역 쌍은 직선거리 × 1.3 ÷ 4.5km/h로 잇는다.
// 같은 이름의 지하철역(다른 호선)은 거리와 상관없이 환승 시간으로 잇는다(좌표가 없어도).
export function buildFootpaths(
  stops: readonly FootpathStop[],
  radiusMeters = FOOTPATH_RADIUS_METERS,
): Footpath[] {
  const paths = new Map<string, Footpath>();
  const located = stops.filter(hasCoordinates);
  for (const pair of nearbyPairs(located, radiusMeters)) {
    paths.set(pairKey(pair.fromId, pair.toId), {
      fromStopId: pair.fromId,
      toStopId: pair.toId,
      walkSeconds: walkSecondsFor(pair.meters),
    });
  }

  const stationsByName = new Map<string, FootpathStop[]>();
  for (const stop of stops) {
    if (stop.mode !== 'subway') continue;
    const group = stationsByName.get(stop.name);
    if (group) group.push(stop);
    else stationsByName.set(stop.name, [stop]);
  }
  for (const [name, stations] of stationsByName) {
    const walkSeconds = transferSecondsAt(name);
    for (const from of stations) {
      for (const to of stations) {
        if (from.id === to.id) continue;
        paths.set(pairKey(from.id, to.id), { fromStopId: from.id, toStopId: to.id, walkSeconds });
      }
    }
  }
  return [...paths.values()];
}
