export const DAY_TYPES = ['weekday', 'sat', 'sun', 'holiday'] as const;

export type DayType = (typeof DAY_TYPES)[number];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SUNDAY = 0;
const SATURDAY = 6;

// "YYYY-MM-DD"의 요일 유형. 공휴일(대체공휴일·선거일 포함)이 토·일보다 우선한다.
export function dayTypeOf(isoDate: string, holidays: ReadonlySet<string>): DayType {
  if (!ISO_DATE_PATTERN.test(isoDate)) {
    throw new Error(`날짜 형식이 YYYY-MM-DD가 아닙니다: ${isoDate}`);
  }
  if (holidays.has(isoDate)) return 'holiday';
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  if (Number.isNaN(weekday)) {
    throw new Error(`없는 날짜입니다: ${isoDate}`);
  }
  if (weekday === SUNDAY) return 'sun';
  if (weekday === SATURDAY) return 'sat';
  return 'weekday';
}
