import { type AnyColumn, sql } from 'drizzle-orm';

// upsert의 SET 절에서 새로 넣으려던 값(EXCLUDED.<컬럼>)을 가리킨다
export function excluded(column: AnyColumn) {
  return sql.raw(`excluded."${column.name}"`);
}
