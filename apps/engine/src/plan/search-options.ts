import {
  DEFAULT_MIN_TRANSFER_MINUTES,
  type TripPlanOptions,
  WALK_TIME_FACTORS,
} from '@makchacut/core';
import type { PlanOptions } from '@makchacut/shared';

// 요청 설정 → core 탐색 옵션 (집 쪽 탐색과 약속 장소 질의가 같은 값을 쓴다)
export function searchOptions(options: PlanOptions): TripPlanOptions {
  return {
    maxRides: options.maxTransfers + 1,
    minTransferMinutes: DEFAULT_MIN_TRANSFER_MINUTES,
    walkTimeFactor: WALK_TIME_FACTORS[options.walkSpeed],
    safetyMarginMinutes: options.safetyMarginMinutes,
  };
}
