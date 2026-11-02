import { dayTypeOf, todayInKorea } from '@makchacut/core';
import type { Db } from '@makchacut/db';
import { ApiBudget, QuotaExhaustedError } from '#jobs/api-budget';
import { finishRun, hasActiveRun, startRun, todayApiCalls } from '#jobs/ingest-run-log';
import {
  ensureListTarget,
  isDue,
  markFailure,
  markSuccess,
  pickDueTargets,
  syncTargets,
} from '#jobs/ingest-targets';
import type { IngestContext, IngestKeys, SourceIngester } from '#jobs/sources/source-ingester';
import { loadHolidayDates } from '#jobs/stores/holiday-store';

const TARGET_BATCH_SIZE = 50;
const MAX_FAILURE_SAMPLES = 5;

export type IngestStopReason = 'done' | 'quota' | 'time' | 'busy';

export type IngestSummary = {
  source: string;
  stoppedBy: IngestStopReason;
  listRefreshed: boolean;
  succeeded: number;
  failed: number;
  rowCount: number;
  apiCalls: number;
  quotaLeftToday: number;
  failures: string[];
};

export type RunIngestOptions = {
  db: Db;
  ingester: SourceIngester;
  keys: IngestKeys;
  // 이 시각이 지나면 새 대상을 시작하지 않는다
  deadline: number;
  // 수동 확인용: 이번 실행의 호출 수를 더 줄인다
  maxCalls?: number;
  now?: () => Date;
};

async function createContext(options: RunIngestOptions, budget: ApiBudget): Promise<IngestContext> {
  const now = (options.now ?? (() => new Date()))();
  const today = todayInKorea(now);
  const holidays = await loadHolidayDates(options.db);
  return {
    db: options.db,
    budget,
    keys: options.keys,
    now,
    today,
    todayType: dayTypeOf(today, holidays),
  };
}

// 출처 하나를 한도·시간 안에서 수집한다. 목록이 오래됐으면 먼저 갱신하고, 오래전에 성공한 대상부터 처리한다.
export async function runIngest(options: RunIngestOptions): Promise<IngestSummary> {
  const { db, ingester } = options;
  const clock = options.now ?? (() => new Date());
  const startedAt = clock();
  const usedToday = await todayApiCalls(db, ingester.source, startedAt);
  const quotaLeft = Math.max(ingester.dailyQuota - usedToday, 0);
  const summary: IngestSummary = {
    source: ingester.source,
    stoppedBy: 'done',
    listRefreshed: false,
    succeeded: 0,
    failed: 0,
    rowCount: 0,
    apiCalls: 0,
    quotaLeftToday: quotaLeft,
    failures: [],
  };
  if (await hasActiveRun(db, ingester.source, startedAt)) return { ...summary, stoppedBy: 'busy' };
  if (quotaLeft === 0) return { ...summary, stoppedBy: 'quota' };

  const budget = new ApiBudget(Math.min(quotaLeft, options.maxCalls ?? quotaLeft));
  const ctx = await createContext(options, budget);
  const runId = await startRun(db, ingester.source);
  const recordFailure = (label: string, error: unknown) => {
    summary.failed += 1;
    if (summary.failures.length < MAX_FAILURE_SAMPLES) {
      summary.failures.push(`${label}: ${String(error)}`);
    }
  };

  try {
    const listTarget = await ensureListTarget(db, ingester.source);
    if (isDue(listTarget, ingester.listRefreshHours, ctx.now)) {
      try {
        const targets = await ingester.listTargets(ctx);
        await syncTargets(db, ingester.source, targets, ctx.now);
        await markSuccess(db, listTarget.id, ctx.now);
        summary.listRefreshed = true;
      } catch (error) {
        if (error instanceof QuotaExhaustedError) throw error;
        await markFailure(db, listTarget.id, error, ctx.now);
        recordFailure('목록', error);
      }
    }

    const tried = new Set<number>();
    while (Date.now() < options.deadline && budget.remaining > 0) {
      const batch = (
        await pickDueTargets(
          db,
          ingester.source,
          ingester.targetRefreshHours,
          TARGET_BATCH_SIZE + tried.size,
          ctx.now,
        )
      ).filter((target) => !tried.has(target.id));
      if (batch.length === 0) break;
      for (const target of batch) {
        if (Date.now() >= options.deadline) break;
        tried.add(target.id);
        try {
          summary.rowCount += await ingester.ingestTarget(ctx, target);
          await markSuccess(db, target.id, clock());
          summary.succeeded += 1;
        } catch (error) {
          if (error instanceof QuotaExhaustedError) throw error;
          await markFailure(db, target.id, error, clock());
          recordFailure(target.targetId, error);
        }
      }
    }
    if (Date.now() >= options.deadline) summary.stoppedBy = 'time';
    else if (budget.remaining === 0) summary.stoppedBy = 'quota';
  } catch (error) {
    if (!(error instanceof QuotaExhaustedError)) {
      await finishRun(db, runId, {
        status: 'failed',
        rowCount: summary.rowCount,
        apiCalls: budget.used,
        errorMessage: String(error),
      });
      throw error;
    }
    summary.stoppedBy = 'quota';
  }

  summary.apiCalls = budget.used;
  summary.quotaLeftToday = quotaLeft - budget.used;
  await finishRun(db, runId, {
    status: 'succeeded',
    rowCount: summary.rowCount,
    apiCalls: budget.used,
    errorMessage: summary.failures.length > 0 ? summary.failures.join('\n') : null,
  });
  return summary;
}
