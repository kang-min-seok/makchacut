import type { Db } from '@makchacut/db';
import type { ComputeKeys, ComputeResult, ComputeStep } from '#compute/compute-step';
import { COMPUTE_RUNNERS } from '#compute/compute-runners';
import { finishRun, hasActiveRun, startRun } from '#jobs/ingest-run-log';

// ingest_run.source에 수집 출처와 구분해 남긴다 (예: compute:stop-last)
const RUN_SOURCE_PREFIX = 'compute:';

export type ComputeSummary = ComputeResult & {
  step: ComputeStep;
  status: 'succeeded' | 'busy';
};

export type RunComputeOptions = {
  db: Db;
  step: ComputeStep;
  keys: ComputeKeys;
  deadline: number;
};

export async function runCompute(options: RunComputeOptions): Promise<ComputeSummary> {
  const { db, step } = options;
  const runSource = `${RUN_SOURCE_PREFIX}${step}`;
  if (await hasActiveRun(db, runSource, new Date())) {
    return { step, status: 'busy', rowCount: 0, apiCalls: 0, warnings: [], details: {} };
  }
  const runId = await startRun(db, runSource);
  try {
    const result = await COMPUTE_RUNNERS[step]({
      db,
      keys: options.keys,
      deadline: options.deadline,
    });
    for (const warning of result.warnings) console.warn(`[${runSource}] ${warning}`);
    await finishRun(db, runId, {
      status: 'succeeded',
      rowCount: result.rowCount,
      apiCalls: result.apiCalls,
      errorMessage: result.warnings.length > 0 ? result.warnings.join('\n') : null,
    });
    return { step, status: 'succeeded', ...result };
  } catch (error) {
    await finishRun(db, runId, {
      status: 'failed',
      rowCount: 0,
      apiCalls: 0,
      errorMessage: String(error),
    });
    throw error;
  }
}
