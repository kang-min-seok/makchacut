import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '#schema';

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
// 트랜잭션 안팎에서 같은 쿼리 함수를 쓰기 위한 실행자
export type DbExecutor = Db | DbTransaction;
