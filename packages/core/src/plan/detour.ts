import type { AccessStop } from '#plan/access';
import { bestLabelAt } from '#raptor/journey';
import type { ReverseRaptorResult } from '#raptor/reverse-raptor';

// 우회 분리: 경로의 총 소요(약속 장소 → 집)가 약속 장소의 평시 총 소요 T*의 배수를 넘으면 "돌아가는 막차"로 본다.
// T*는 같은 엔진으로 평시에 집에 도착하는 탐색(arriveBy)을 돌려 구한다.
// 정류장별 한도(T*(s) × 배수)를 건 탐색은 판정이 아니라 후보 모으기용이다 — 역방향 RAPTOR가 같은 탑승 횟수에
// 더 늦게 출발하는 우회 라벨로 짧은 경로 라벨을 덮어쓰므로, 한도로 우회를 미리 쳐내 짧은 경로 후보를 남긴다.

export const DETOUR_LEVELS = ['optimal', 'some', 'any'] as const;
export type DetourLevel = (typeof DETOUR_LEVELS)[number];

export const DETOUR_MULTIPLIERS: Readonly<Record<DetourLevel, number>> = {
  optimal: 1.2,
  some: 1.5,
  any: Infinity,
};

// 평시 기준: 22시에 집 도착 (대략 21시 전후 출발)
export const NORMAL_HOME_ARRIVAL_MINUTES = 22 * 60;

// 평시 탐색 결과에서 이 정류장 → 집 소요(분). 평시에 갈 수 없으면 undefined.
export function normalTravelMinutes(
  normalResult: ReverseRaptorResult,
  stop: number,
): number | undefined {
  const label = bestLabelAt(normalResult, stop);
  if (!label || !Number.isFinite(label.value)) return undefined;
  return NORMAL_HOME_ARRIVAL_MINUTES - label.value;
}

// 약속 장소에서 집까지 평시 총 소요(분): 주변 정류장마다 도보 + 그 정류장 평시 소요 중 가장 짧은 것. 평시에 갈 수 없으면 undefined.
export function normalTravelFrom(
  normalResult: ReverseRaptorResult,
  access: readonly AccessStop[],
): number | undefined {
  const totals = access.flatMap((a) => {
    const normal = normalTravelMinutes(normalResult, a.stop);
    return normal === undefined ? [] : [a.walkMinutes + normal];
  });
  return totals.length > 0 ? Math.min(...totals) : undefined;
}

// 정류장별 최대 소요(평시 소요 × 배수). 평시 소요를 모르면 비교할 기준이 없어 제한하지 않는다.
// 'any'(집에만 가면 됨)는 제한이 없으므로 undefined.
export function detourTravelLimits(
  normalResult: ReverseRaptorResult,
  stopCount: number,
  level: DetourLevel,
): Float64Array | undefined {
  const multiplier = DETOUR_MULTIPLIERS[level];
  if (!Number.isFinite(multiplier)) return undefined;
  const limits = new Float64Array(stopCount).fill(Infinity);
  for (let stop = 0; stop < stopCount; stop += 1) {
    const normal = normalTravelMinutes(normalResult, stop);
    if (normal !== undefined) limits[stop] = normal * multiplier;
  }
  return limits;
}
