import { type DayType, dayTypeOf } from '@makchacut/core';
import type { Db } from '@makchacut/db';
import { isHoliday } from '#jobs/stores/holiday-store';

// 요청 날짜의 요일 유형 (특일이면 휴일 그래프)
export async function requestDayType(db: Db, date: string): Promise<DayType> {
  const holidays = (await isHoliday(db, date)) ? new Set([date]) : new Set<string>();
  return dayTypeOf(date, holidays);
}
