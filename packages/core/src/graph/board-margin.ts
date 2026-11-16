import type { TimedStop } from '#graph/timed-stop';

// 신뢰도 여유는 타는 시각에만: 보정된 출발에서 빼고 도착은 그대로 둔다
export function applyBoardMargin(stops: TimedStop[]): void {
  for (const s of stops) s.departure -= s.boardMargin;
}
