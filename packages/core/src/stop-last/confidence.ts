// 낮은 것부터. "한 단계 낮춤"을 순서로 표현한다.
export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

// 서울 API lastTm > GBIS 웹 ptts 누적 > 구간 유형별 속도 거리 추정 (ADR 4항)
export const LAST_TIME_SOURCES = ['seoul_api', 'gbis_eta', 'distance'] as const;
export type LastTimeSource = (typeof LAST_TIME_SOURCES)[number];

export function lowerConfidence(level: Confidence, steps = 1): Confidence {
  const index = Math.max(CONFIDENCE_LEVELS.indexOf(level) - steps, 0);
  return CONFIDENCE_LEVELS[index] ?? 'low';
}
