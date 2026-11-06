'use client';

import type { PlanResponse } from '@makchacut/shared';
import type { ReactNode } from 'react';
import {
  InvalidTargetState,
  NeedHomeState,
  NoRouteState,
  PlanLoading,
  UnavailableState,
} from '@/components/plan/plan-states';
import { PlanRequestError } from '@/hooks/use-plan';
import type { TargetPlanState } from '@/hooks/use-target-plan';
import { planHref, type PlanTarget } from '@/lib/plan-target';
import { homeRegisterHref } from '@/lib/routes';

type PlanGateProps = {
  state: TargetPlanState;
  // 결과가 없을 때(로딩·오류) 위에 둘 머리
  header: ReactNode;
  children: (plan: PlanResponse, target: PlanTarget) => ReactNode;
};

// 계산 결과가 준비될 때까지의 상태(주소 오류·집 없음·로딩·오류)를 대신 그린다
export function PlanGate({ state, header, children }: PlanGateProps) {
  if (state.status === 'ready' && state.query.isSuccess) {
    return children(state.query.data, state.target);
  }
  return (
    <>
      {header}
      <GateBody state={state} />
    </>
  );
}

function GateBody({ state }: { state: TargetPlanState }) {
  if (state.status === 'invalid') return <InvalidTargetState />;
  if (state.status === 'need-home') {
    return <NeedHomeState registerHref={homeRegisterHref(planHref(state.target))} />;
  }
  if (state.status === 'loading-home' || !state.query.isError) return <PlanLoading />;
  const { error, refetch } = state.query;
  return error instanceof PlanRequestError && error.kind === 'no_route' ? (
    <NoRouteState />
  ) : (
    <UnavailableState onRetry={() => void refetch()} />
  );
}
