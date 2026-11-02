import { and, gte, lte } from 'drizzle-orm';
import type { Holiday } from '@makchacut/data';
import { type DbExecutor, holiday } from '@makchacut/db';

export async function replaceYearHolidays(
  db: DbExecutor,
  year: number,
  holidays: readonly Holiday[],
): Promise<void> {
  await db
    .delete(holiday)
    .where(and(gte(holiday.date, `${year}-01-01`), lte(holiday.date, `${year}-12-31`)));
  // 같은 날 특일이 둘이면(예: 대체공휴일 겹침) 첫 이름만 남긴다
  const unique = [...new Map(holidays.map((h) => [h.date, h])).values()];
  if (unique.length > 0) await db.insert(holiday).values(unique);
}

export async function loadHolidayDates(db: DbExecutor): Promise<Set<string>> {
  const rows = await db.select({ date: holiday.date }).from(holiday);
  return new Set(rows.map((row) => row.date));
}
