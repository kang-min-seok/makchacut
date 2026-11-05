export const MAX_FAILURE_SAMPLES = 5;

// 실패 샘플은 마지막 몇 건만 남긴다 — 원천 장애로 멈췄을 때 그 원인이 보이게
export function keepLatestFailure(samples: readonly string[], sample: string): string[] {
  return [...samples, sample].slice(-MAX_FAILURE_SAMPLES);
}
