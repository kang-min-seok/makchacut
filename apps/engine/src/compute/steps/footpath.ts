import { buildFootpaths } from '@makchacut/core';
import { rowChangeWarning } from '#compute/change-warning';
import type { ComputeStepRunner } from '#compute/compute-step';
import {
  countFootpaths,
  loadFootpathStops,
  replaceFootpaths,
} from '#compute/stores/footpath-store';

// 도보 간선(반경 400m 정류장·역 쌍 + 같은 역 다른 호선 환승)을 전부 다시 만든다
export const computeFootpaths: ComputeStepRunner = async ({ db }) => {
  const stops = await loadFootpathStops(db);
  const paths = buildFootpaths(stops);
  const before = await countFootpaths(db);
  await db.transaction((tx) => replaceFootpaths(tx, paths));
  const warning = rowChangeWarning('footpath', before, paths.length);
  return {
    rowCount: paths.length,
    apiCalls: 0,
    warnings: warning ? [warning] : [],
    details: { before, stops: stops.length },
  };
};
