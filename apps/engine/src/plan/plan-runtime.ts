import { createDb } from '@makchacut/db';
import { loadPlanDatabaseUrl } from '#config';
import { createGraphCache } from '#plan/graph-cache';
import { createPlanner, type Planner } from '#plan/planner';

// 함수 인스턴스가 사는 동안 연결 하나로 스냅샷·특일만 읽는다
const PLAN_DB_MAX_CONNECTIONS = 1;
const PLAN_DB_IDLE_TIMEOUT_SECONDS = 20;

export function createPlannerFromEnv(env: NodeJS.ProcessEnv = process.env): Planner | undefined {
  const databaseUrl = loadPlanDatabaseUrl(env);
  if (!databaseUrl) return undefined;
  const db = createDb(databaseUrl, {
    maxConnections: PLAN_DB_MAX_CONNECTIONS,
    idleTimeoutSeconds: PLAN_DB_IDLE_TIMEOUT_SECONDS,
  });
  return createPlanner({ db, graphs: createGraphCache(db) });
}
