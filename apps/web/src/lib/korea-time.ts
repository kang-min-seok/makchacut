const KOREA_TIME_ZONE = 'Asia/Seoul';

const clockFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KOREA_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOREA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatKoreaClock(isoDateTime: string): string {
  return clockFormatter.format(new Date(isoDateTime));
}

export function todayInKorea(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}
