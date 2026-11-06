'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { PlanResponseSchema, type PlanRequest, type PlanResponse } from '@makchacut/shared';
import { PLAN_API_PATH, planErrorKindOf, type PlanErrorKind } from '@/lib/plan-api';

export class PlanRequestError extends Error {
  constructor(readonly kind: PlanErrorKind) {
    super(kind);
  }
}

async function fetchPlan(request: PlanRequest): Promise<PlanResponse> {
  let res: Response;
  try {
    res = await fetch(PLAN_API_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new PlanRequestError('unavailable');
  }
  if (!res.ok) throw new PlanRequestError(planErrorKindOf(res.status));
  const parsed = PlanResponseSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new PlanRequestError('unavailable');
  return parsed.data;
}

// 같은 요청은 결과·상세 화면이 캐시를 함께 쓴다
export function usePlan(request: PlanRequest | null) {
  return useQuery({
    queryKey: ['plan', request],
    queryFn: request ? () => fetchPlan(request) : skipToken,
  });
}
