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

// 04~06시 값이 기준(그날 밤 시각)보다 반나절 넘게 이르면 서비스 일자 04시 경계를 넘어 아침으로 접힌 심야 값이다
// (33-1 회차점 막차 04:10 → 250분). 더 늦은 낮 시각은 접힘이 아니라 잘못된 값이라 그대로 둔다.
const FOLD_WINDOW_END_MINUTES = 6 * 60;
const FOLDED_GAP_MINUTES = 12 * 60;

export function unfoldServiceMinutes(minutes: number, reference: number): number {
  const folded = minutes < FOLD_WINDOW_END_MINUTES && reference - minutes > FOLDED_GAP_MINUTES;
  return folded ? minutes + MINUTES_PER_DAY : minutes;
}
