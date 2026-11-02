import { type DayType, toServiceMinutes } from '@makchacut/core';
import type {
  SeoulSubwayInoutTag,
  SeoulSubwayTimetableRow,
  SeoulSubwayWeekTag,
} from '#seoul-subway';

export type TrainDirection = 'up' | 'down';

export type SubwayStopTime = {
  trainNo: string;
  arrivalMinutes: number | null;
  departureMinutes: number | null;
  destinationCode: string;
  destinationName: string;
  isExpress: boolean;
};

// 휴일(3) 시간표는 일요일과 공휴일에 같이 쓴다
export const SEOUL_WEEK_TAG_DAY_TYPES: Record<SeoulSubwayWeekTag, DayType[]> = {
  '1': ['weekday'],
  '2': ['sat'],
  '3': ['sun', 'holiday'],
};

export const SEOUL_INOUT_DIRECTION: Record<SeoulSubwayInoutTag, TrainDirection> = {
  '1': 'up',
  '2': 'down',
};

const NO_TIME = '00:00:00';
const EXPRESS_FLAG = 'D';

function minutesOrNull(clock: string): number | null {
  if (!clock || clock === NO_TIME) return null;
  return toServiceMinutes(clock) ?? null;
}

export function toSubwayStopTime(row: SeoulSubwayTimetableRow): SubwayStopTime {
  return {
    trainNo: row.trainNo,
    arrivalMinutes: minutesOrNull(row.arrival),
    departureMinutes: minutesOrNull(row.departure),
    destinationCode: row.destinationCode,
    destinationName: row.destinationName,
    isExpress: row.expressFlag === EXPRESS_FLAG,
  };
}
