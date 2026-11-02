export type RouteDirection = 'outbound' | 'inbound';

// 회차점까지(포함)는 회차 전, 그 뒤는 회차 후. 회차점을 모르면 전부 회차 전으로 둔다.
export function directionsByTurn(stopCount: number, turnIndex: number): RouteDirection[] {
  return Array.from({ length: stopCount }, (_, index) =>
    turnIndex >= 0 && index > turnIndex ? 'inbound' : 'outbound',
  );
}
