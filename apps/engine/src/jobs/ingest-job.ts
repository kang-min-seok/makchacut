import { createDb } from '@makchacut/db';
import type { IngestConfig } from '#config';
import { INGESTERS } from '#jobs/ingesters';
import type { IngestSource } from '#jobs/ingest-targets';
import { type IngestSummary, runIngest } from '#jobs/run-ingest';

// Vercel 함수 1회 최대 300초 중 마무리 기록 시간을 남긴다
const TIME_BUDGET_MS = 240_000;
const DB_CLOSE_TIMEOUT_SECONDS = 5;

export type IngestJobRequest = {
  source: IngestSource;
  maxCalls?: number;
};

export type RunIngestJob = (
  config: IngestConfig,
  request: IngestJobRequest,
) => Promise<IngestSummary>;

// 요청마다 DB 연결을 열고 닫는다
export const runIngestJob: RunIngestJob = async (config, request) => {
  const db = createDb(config.databaseUrl);
  try {
    return await runIngest({
      db,
      ingester: INGESTERS[request.source],
      keys: { dataGoKr: config.dataGoKrServiceKey, seoulOpenData: config.seoulOpenDataKey },
      deadline: Date.now() + TIME_BUDGET_MS,
      maxCalls: request.maxCalls,
    });
  } finally {
    await db.$client.end({ timeout: DB_CLOSE_TIMEOUT_SECONDS });
  }
};
