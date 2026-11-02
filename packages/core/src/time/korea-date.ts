export const KOREA_TIME_ZONE = 'Asia/Seoul';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOREA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// 한국 시각 기준 오늘 날짜 "YYYY-MM-DD"
export function todayInKorea(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}
