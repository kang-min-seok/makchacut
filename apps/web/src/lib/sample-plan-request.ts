import type { PlanRequest } from '@makchacut/shared';

const DONGTAN_STATION = { lat: 37.2006, lng: 127.0957 };
const MORAN_STATION = { lat: 37.4321, lng: 127.1295 };

export function createSamplePlanRequest(date: string): PlanRequest {
  return { home: DONGTAN_STATION, meetup: MORAN_STATION, date };
}
