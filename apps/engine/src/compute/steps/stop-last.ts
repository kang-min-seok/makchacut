import { buildStopLast } from '#compute/build-stop-last';
import { distanceFallbackWarning, rowChangeWarning } from '#compute/change-warning';
import type { ComputeStepRunner } from '#compute/compute-step';
import {
  countStopLast,
  loadStopLastInputs,
  replaceStopLast,
} from '#compute/stores/stop-last-store';

// 정류장별 막차(bus_stop_last)를 전부 다시 계산한다
export const computeStopLast: ComputeStepRunner = async ({ db }) => {
  const inputs = await loadStopLastInputs(db);
  const build = buildStopLast(inputs);
  const before = await countStopLast(db);
  await db.transaction((tx) => replaceStopLast(tx, build.rows));
  const warnings = [
    rowChangeWarning('bus_stop_last', before, build.rows.length),
    distanceFallbackWarning(build.distanceRoutes, build.gbisRoutes),
  ].filter((w): w is string => w !== undefined);
  return {
    rowCount: build.rows.length,
    apiCalls: 0,
    warnings,
    details: {
      before,
      gbisRoutes: build.gbisRoutes,
      distanceRoutes: build.distanceRoutes,
      seoulRoutesMergedIntoGbis: build.seoulRoutesMergedIntoGbis,
    },
  };
};
