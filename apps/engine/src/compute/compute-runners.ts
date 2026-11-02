import type { ComputeStep, ComputeStepRunner } from '#compute/compute-step';
import { computeFootpaths } from '#compute/steps/footpath';
import { mergeStops } from '#compute/steps/merge-stops';
import { computeStopLast } from '#compute/steps/stop-last';
import { fillSubwayCoords } from '#compute/steps/subway-coords';

// 순서대로 돈다: 역 좌표 → 정류장 통합 → 정류장별 막차 → 도보 간선 (pg_cron도 이 순서로 띄워 부른다)
export const COMPUTE_RUNNERS: Record<ComputeStep, ComputeStepRunner> = {
  'subway-coords': fillSubwayCoords,
  'merge-stops': mergeStops,
  'stop-last': computeStopLast,
  footpath: computeFootpaths,
};
