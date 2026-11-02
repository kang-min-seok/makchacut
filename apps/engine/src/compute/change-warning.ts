// 전체를 다시 쓰는 계산 결과의 행 수가 이만큼 줄거나 늘면 경고한다.
// 수집이 한 바퀴 도는 첫 주에는 늘어나는 경고가 정상이다.
const MAX_SHRINK_RATIO = 0.1;
const MAX_GROWTH_RATIO = 0.5;
// GBIS 웹 ptts 대신 거리 추정을 쓴 경기 노선 비율 — 넘으면 웹 응답 형식이 바뀌었다는 신호다 (ADR 2항)
const MAX_DISTANCE_FALLBACK_RATIO = 0.2;
const PERCENT = 100;

const percent = (ratio: number) => `${Math.round(ratio * PERCENT)}%`;

export function rowChangeWarning(label: string, before: number, after: number): string | undefined {
  if (before === 0) return undefined;
  const change = (after - before) / before;
  if (change < -MAX_SHRINK_RATIO || change > MAX_GROWTH_RATIO) {
    return `${label} 행 수 급변: ${before} → ${after} (${change > 0 ? '+' : ''}${percent(change)})`;
  }
  return undefined;
}

export function distanceFallbackWarning(
  distanceRoutes: number,
  totalRoutes: number,
): string | undefined {
  if (totalRoutes === 0) return undefined;
  const ratio = distanceRoutes / totalRoutes;
  return ratio > MAX_DISTANCE_FALLBACK_RATIO
    ? `경기 노선 ptts 대체(거리 추정) 비율 ${percent(ratio)} (${distanceRoutes}/${totalRoutes})`
    : undefined;
}
