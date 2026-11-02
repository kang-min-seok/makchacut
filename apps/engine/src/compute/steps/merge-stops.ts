import { planStopMerges } from '@makchacut/core';
import type { ComputeStepRunner } from '#compute/compute-step';
import { applyStopMerges, loadBusSourcePoints } from '#compute/stores/stop-merge-store';

// 서울·경기 버스 원본 정류장 중 같은 정류장을 하나의 통합 정류장으로 묶는다. 이미 묶인 것은 그대로라 다시 돌려도 된다.
export const mergeStops: ComputeStepRunner = async ({ db }) => {
  const points = await loadBusSourcePoints(db);
  const merges = planStopMerges(points);
  await db.transaction((tx) => applyStopMerges(tx, merges));
  return {
    rowCount: merges.size,
    apiCalls: 0,
    warnings: [],
    details: { sourceStops: points.length, merged: merges.size },
  };
};
