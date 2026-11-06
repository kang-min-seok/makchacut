import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '#schema';

export type DbOptions = {
  // 연결 수 상한 (기본: postgres.js 기본값)
  maxConnections?: number;
  // 쉬는 연결을 닫는 초 (오래 사는 함수 인스턴스용)
  idleTimeoutSeconds?: number;
};

export function createDb(databaseUrl: string, options: DbOptions = {}) {
  const client = postgres(databaseUrl, {
    prepare: false,
    max: options.maxConnections,
    idle_timeout: options.idleTimeoutSeconds,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
// 트랜잭션 안팎에서 같은 쿼리 함수를 쓰기 위한 실행자
export type DbExecutor = Db | DbTransaction;
