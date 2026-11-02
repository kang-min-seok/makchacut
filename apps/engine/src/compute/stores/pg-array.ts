import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// 대량 insert를 unnest(배열 파라미터)로 보낸다. 행마다 바인드 파라미터를 쓰는 VALUES보다 훨씬 적은 문장으로 끝난다.
// 값은 숫자·enum 문자열(따옴표·쉼표 없음)만 받는다.
export function pgArray(values: readonly (number | string | null)[]): string {
  return `{${values.map((value) => (value === null ? 'NULL' : String(value))).join(',')}}`;
}

export const UNNEST_CHUNK_SIZE = 20_000;

export function unnestColumns(columns: readonly { values: string; type: string }[]): SQL {
  return sql.join(
    columns.map((column) => sql`${column.values}::${sql.raw(column.type)}[]`),
    sql`, `,
  );
}
