// 시각을 "서비스 일자 기준 분"으로 바꾼다. 새벽 4시 전은 전날 운행으로 보고 24시간을 더한다(00:40 → 1480).

export const SERVICE_DAY_CUTOFF_MINUTES = 4 * 60;
const MINUTES_PER_DAY = 24 * 60;

// "HH:MM", "HH:MM:SS", "HHMMSS" 를 받는다. 형식이 다르거나 빈 값이면 undefined.
export function toServiceMinutes(clock: string): number | undefined {
  const match = /^(\d{1,2}):?(\d{2})(?::?(\d{2}))?$/.exec(clock.trim());
  if (!match) return undefined;
  const minutes = Number(match[1]) * 60 + Number(match[2]) + Number(match[3] ?? 0) / 60;
  return minutes < SERVICE_DAY_CUTOFF_MINUTES ? minutes + MINUTES_PER_DAY : minutes;
}

// "HHMMSS" → "HH:MM:SS". 그 외 형식은 그대로 돌려준다.
export function formatClock(clock: string): string {
  const match = /^(\d{2})(\d{2})(\d{2})$/.exec(clock.trim());
  return match ? `${match[1]}:${match[2]}:${match[3]}` : clock;
}

// 서비스 일자 기준 분 → "HH:MM" (24시 넘으면 다시 00시부터)
export function minutesToClock(minutes: number): string {
  const rounded = Math.round(minutes) % MINUTES_PER_DAY;
  const hh = String(Math.floor(rounded / 60)).padStart(2, '0');
  const mm = String(rounded % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// 자정 넘어 운행하는 노선(기준 막차가 24시 이후)의 04~06시 값은 서비스 일자 04시 경계를 넘어 아침으로 접힌 심야 값이다
// (33-1 기점 03:30, 회차점 04:10 → 250분). 자정 전에 끝나는 노선의 04~06시 값은 첫차 시각 같은 잘못된 값이라 그대로 둔다(1162·4300-2).
const FOLD_WINDOW_END_MINUTES = 6 * 60;

export function unfoldServiceMinutes(minutes: number, reference: number): number {
  const folded = reference >= MINUTES_PER_DAY && minutes < FOLD_WINDOW_END_MINUTES;
  return folded ? minutes + MINUTES_PER_DAY : minutes;
}
