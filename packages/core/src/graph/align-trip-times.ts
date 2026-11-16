import type { TimedStop } from '#graph/timed-stop';

// 입력 순서 그대로 도착 ≤ 출발, 직전 출발 ≤ 도착을 맞춘다
export function alignTripTimes(stops: TimedStop[]): void {
  let previous = -Infinity;
  for (const s of stops) {
    const departure = Math.max(s.departure, previous);
    s.arrival = Math.min(Math.max(s.arrival, previous), departure);
    s.departure = departure;
    previous = departure;
  }
}
