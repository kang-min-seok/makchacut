import { buildTransitGraph, DAY_TYPES, patternCount, stopCount } from '@makchacut/core';
import type { ComputeStepRunner } from '#compute/compute-step';
import { encodeGraphSnapshot } from '#graph/graph-snapshot';
import { loadGraphInput } from '#graph/stores/graph-input-store';
import { saveGraphSnapshot } from '#graph/stores/graph-snapshot-store';

// 요일 유형마다 탐색 그래프를 만들어 스냅샷으로 저장한다 (계산 단계의 마지막)
export const computeGraphSnapshots: ComputeStepRunner = async ({ db }) => {
  const details: Record<string, number> = {};
  const warnings: string[] = [];
  for (const dayType of DAY_TYPES) {
    const input = await loadGraphInput(db, dayType);
    const { graph, skippedTrips, droppedStopTimes } = buildTransitGraph(input);
    const data = encodeGraphSnapshot(graph);
    const tripCount = graph.tripLabels.length;
    await saveGraphSnapshot(db, {
      dayType,
      data,
      stopCount: stopCount(graph),
      patternCount: patternCount(graph),
      tripCount,
    });
    details[`${dayType}Bytes`] = data.length;
    details[`${dayType}Trips`] = tripCount;
    if (tripCount === 0) warnings.push(`${dayType} 그래프에 운행이 없습니다`);
    if (skippedTrips > 0 || droppedStopTimes > 0) {
      details[`${dayType}SkippedTrips`] = skippedTrips;
      details[`${dayType}DroppedStopTimes`] = droppedStopTimes;
    }
  }
  return { rowCount: DAY_TYPES.length, apiCalls: 0, warnings, details };
};
