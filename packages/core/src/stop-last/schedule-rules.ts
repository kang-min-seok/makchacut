import type { ScheduleLast } from '#stop-last/estimate-from-schedule';
import { unfoldServiceMinutes } from '#time/service-day';

export type DaySchedule = ScheduleLast & {
  firstAtOrigin: number | null;
  firstAtTurn: number | null;
};

// 첫차·막차가 둘 다 00:00이면 그 방향은 운행하지 않는다는 표시다 (GBIS·서울 공통 — 주말 미운행 출근·예약 노선, 회차 후 운행 없는 통학 노선)
const NO_SERVICE_MINUTES = 24 * 60;
// 기점 막차가 01:30~04:00인데 밤에 운행을 시작하는 노선이 아니면 새벽 첫차 노선(새벽A148·100출성남·반디1)이거나 잘못된 값이다
const LATE_NIGHT_START_MINUTES = 25.5 * 60;
// 첫차가 그날 18시~24시면 밤에 운행을 시작하는 심야 노선이다 (화성 H4·H5 마을버스 22:00~02:50, 33-1 농어촌 23:40~03:30)
const NIGHT_SERVICE_START_MINUTES = 18 * 60;
const NIGHT_ROUTE_NAME = /^N\d/;

const isNoService = (first: number | null, last: number | null) =>
  first === NO_SERVICE_MINUTES && last === NO_SERVICE_MINUTES;

function startsAtNight(routeName: string, firstAtOrigin: number | null): boolean {
  if (NIGHT_ROUTE_NAME.test(routeName)) return true;
  return (
    firstAtOrigin !== null &&
    firstAtOrigin >= NIGHT_SERVICE_START_MINUTES &&
    firstAtOrigin < NO_SERVICE_MINUTES
  );
}

// 정류장 막차 계산에 쓸 그 요일 시간표. 운행하지 않거나 믿을 수 없으면 undefined (그 요일 행을 만들지 않는다).
export function usableSchedule(routeName: string, schedule: DaySchedule): ScheduleLast | undefined {
  const lastAtOrigin = isNoService(schedule.firstAtOrigin, schedule.lastAtOrigin)
    ? null
    : schedule.lastAtOrigin;
  const turnLast = isNoService(schedule.firstAtTurn, schedule.lastAtTurn)
    ? null
    : schedule.lastAtTurn;
  const lastAtTurn =
    turnLast !== null && lastAtOrigin !== null
      ? unfoldServiceMinutes(turnLast, lastAtOrigin)
      : turnLast;
  if (lastAtOrigin === null && lastAtTurn === null) return undefined;
  if (
    lastAtOrigin !== null &&
    lastAtOrigin >= LATE_NIGHT_START_MINUTES &&
    !startsAtNight(routeName, schedule.firstAtOrigin)
  ) {
    return undefined;
  }
  return { lastAtOrigin, lastAtTurn };
}
