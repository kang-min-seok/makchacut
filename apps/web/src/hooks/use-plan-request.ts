'use client';

import { useCallback, useState } from 'react';
import { PlanResponseSchema, type PlanRequest, type PlanResponse } from '@makchacut/shared';

const PLAN_API_PATH = '/api/plan';

export type PlanRequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; plan: PlanResponse }
  | { status: 'error'; message: string };

export function usePlanRequest() {
  const [state, setState] = useState<PlanRequestState>({ status: 'idle' });

  const submit = useCallback(async (request: PlanRequest) => {
    setState({ status: 'loading' });
    try {
      const res = await fetch(PLAN_API_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        setState({ status: 'error', message: `요청 실패 (${res.status})` });
        return;
      }
      setState({ status: 'success', plan: PlanResponseSchema.parse(await res.json()) });
    } catch {
      setState({ status: 'error', message: '엔진에 연결하지 못했어요' });
    }
  }, []);

  return { state, submit };
}
