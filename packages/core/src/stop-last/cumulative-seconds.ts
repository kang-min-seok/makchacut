import { distanceMeters, hasCoordinates } from '#geo/distance';
import type { LastTimeSource } from '#stop-last/confidence';
import { isPassingStop } from '#transit/passing-stop';

export type RouteDirection = 'outbound' | 'inbound';

export type StopLastStop = {
  seq: number;
  name: string;
  // 회차점까지(포함) outbound, 그 뒤 inbound
  direction: RouteDirection;
  lat: number | null;
  lng: number | null;
  // 직전 정류장 → 이 정류장 (GBIS 웹 ptts·length). 첫 정류장은 0.
  segmentSeconds: number | null;
  segmentMeters: number | null;
};

export type TravelSpeeds = {
  // (경유)/(미정차) 통과 구간 — 고속도로
  passingKmh: number;
  cityKmh: number;
};

// 6003 판교→이마트: 고속 구간 22km를 80km/h로 보면 ptts(17분)와 맞는다 (ADR 2항)
export const DEFAULT_TRAVEL_SPEEDS: TravelSpeeds = { passingKmh: 80, cityKmh: 25 };

const SECONDS_PER_HOUR = 3600;
const METERS_PER_KM = 1000;

export type CumulativeSeconds = {
  source: Extract<LastTimeSource, 'gbis_eta' | 'distance'>;
  // 첫 정류장부터 누적 초. 거리를 모르는 구간 뒤로는 undefined.
  seconds: (number | undefined)[];
};

function segmentMetersOf(prev: StopLastStop, stop: StopLastStop): number | undefined {
  if (stop.segmentMeters !== null) return stop.segmentMeters;
  return hasCoordinates(prev) && hasCoordinates(stop) ? distanceMeters(prev, stop) : undefined;
}

function accumulate(
  stops: readonly StopLastStop[],
  segment: (index: number) => number | undefined,
) {
  const seconds: (number | undefined)[] = [];
  let total: number | undefined = 0;
  stops.forEach((_, index) => {
    if (index > 0 && total !== undefined) {
      const step = segment(index);
      total = step === undefined ? undefined : total + step;
    }
    seconds.push(total);
  });
  return seconds;
}

// 모든 구간에 ptts가 있으면 ptts 누적(gbis_eta), 아니면 구간 유형별 속도로 거리 추정(distance)
export function cumulativeSeconds(
  stops: readonly StopLastStop[],
  speeds: TravelSpeeds = DEFAULT_TRAVEL_SPEEDS,
): CumulativeSeconds {
  if (stops.length > 0 && stops.slice(1).every((stop) => stop.segmentSeconds !== null)) {
    return { source: 'gbis_eta', seconds: accumulate(stops, (i) => stops[i]?.segmentSeconds ?? 0) };
  }
  return {
    source: 'distance',
    seconds: accumulate(stops, (i) => {
      const prev = stops[i - 1];
      const stop = stops[i];
      if (!prev || !stop) return undefined;
      const meters = segmentMetersOf(prev, stop);
      if (meters === undefined) return undefined;
      const passing = isPassingStop(prev.name) || isPassingStop(stop.name);
      const kmh = passing ? speeds.passingKmh : speeds.cityKmh;
      return (meters / METERS_PER_KM / kmh) * SECONDS_PER_HOUR;
    }),
  };
}
