'use client';

import type { PlanRequest } from '@makchacut/shared';
import { useSearchParams } from 'next/navigation';
import { usePlan } from '@/hooks/use-plan';
import { NOT_LOADED, useStoredValue } from '@/hooks/use-stored-value';
import { homePlace } from '@/lib/home-place';
import type { Place } from '@/lib/place';
import { parsePlanTarget, type PlanTarget } from '@/lib/plan-target';
import { DEFAULT_USER_SETTINGS, userSettings } from '@/lib/user-settings';

export type TargetPlanState =
  | { status: 'invalid' }
  | { status: 'loading-home'; target: PlanTarget }
  | { status: 'need-home'; target: PlanTarget }
  | { status: 'ready'; target: PlanTarget; query: ReturnType<typeof usePlan> };

function toRequest(target: PlanTarget, home: Place, options: PlanRequest['options']): PlanRequest {
  return {
    home: { lat: home.lat, lng: home.lng },
    meetup: { lat: target.lat, lng: target.lng },
    date: target.date,
    options,
  };
}

// 주소의 약속 장소·날짜 + 이 기기의 집·설정으로 계산을 요청한다
export function useTargetPlan(): TargetPlanState {
  const target = parsePlanTarget(new URLSearchParams(useSearchParams()));
  const home = useStoredValue(homePlace);
  const settings = useStoredValue(userSettings);
  const ready = target !== null && home !== NOT_LOADED && home !== null;
  const options = settings === NOT_LOADED || settings === null ? DEFAULT_USER_SETTINGS : settings;
  const query = usePlan(ready ? toRequest(target, home, options) : null);

  if (!target) return { status: 'invalid' };
  if (home === NOT_LOADED) return { status: 'loading-home', target };
  if (home === null) return { status: 'need-home', target };
  return { status: 'ready', target, query };
}
