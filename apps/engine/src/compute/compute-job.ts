import { createDb } from '@makchacut/db';
import type { IngestConfig } from '#config';
import type { ComputeStep } from '#compute/compute-step';
import { type ComputeSummary, runCompute } from '#compute/run-compute';

// Vercel 함수 1회 최대 300초 중 쓰기·기록 시간을 남긴다
const TIME_BUDGET_MS = 200_000;
const DB_CLOSE_TIMEOUT_SECONDS = 5;

export type RunComputeJob = (config: IngestConfig, step: ComputeStep) => Promise<ComputeSummary>;

// 요청마다 DB 연결을 열고 닫는다
export const runComputeJob: RunComputeJob = async (config, step) => {
  const db = createDb(config.databaseUrl);
  try {
    return await runCompute({
      db,
      step,
      keys: { seoulOpenData: config.seoulOpenDataKey, kakaoRest: config.kakaoRestApiKey },
      deadline: Date.now() + TIME_BUDGET_MS,
    });
  } finally {
    await db.$client.end({ timeout: DB_CLOSE_TIMEOUT_SECONDS });
  }
};
