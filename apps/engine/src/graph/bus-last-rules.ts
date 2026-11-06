import type { BusStopLastRow } from '#graph/bus-trips';

// 그래프에 넣지 않을 정류장 막차 (M1-1 계산 보완 전까지 엔진에서 거른다)

// 심야 노선이 아닌데 막차가 01:30~04:00이면 첫차·새벽 운행을 막차로 잘못 읽은 값으로 본다 (서비스 일자 분)
const LATE_NIGHT_START_MINUTES = 25.5 * 60;
const NIGHT_ROUTE_NAME = /^N\d/;

export function isNightRoute(routeName: string): boolean {
  return NIGHT_ROUTE_NAME.test(routeName);
}

function isImplausiblyLate(row: BusStopLastRow): boolean {
  return row.lastMinutes >= LATE_NIGHT_START_MINUTES && !isNightRoute(row.routeName);
}

// 서울 전용 노선은 서울 API가 조회한 날의 요일 값만 준다 → 그 요일 시간표가 없으면 다른 요일 값을 빌린 추정이라 운행 안 함으로 본다
function borrowsAnotherDay(row: BusStopLastRow): boolean {
  return row.routeSource === 'seoul_bus' && !row.hasDaySchedule;
}

export function usableBusStopLast(rows: readonly BusStopLastRow[]): BusStopLastRow[] {
  return rows.filter((row) => !isImplausiblyLate(row) && !borrowsAnotherDay(row));
}
