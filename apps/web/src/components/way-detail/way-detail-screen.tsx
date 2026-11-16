'use client';

import type { PlanResponse } from '@makchacut/shared';
import { useSearchParams } from 'next/navigation';
import { TopBar } from '@/components/layout/top-bar';
import { PlanGate } from '@/components/plan/plan-gate';
import { NoRouteState } from '@/components/plan/plan-states';
import { Pill } from '@/components/ui/pill';
import { WayTimeline } from '@/components/way-detail/way-timeline';
import { useTargetPlan } from '@/hooks/use-target-plan';
import { formatDuration, formatKoreaClock } from '@/lib/korea-time';
import { FIRST_WAY, parseWayRef, type PlanTarget, type WayRef } from '@/lib/plan-target';
import { hasEstimatedRide, selectWay, summarizeWay } from '@/lib/plan-view';

const TITLE = '경로 상세';

export function WayDetailScreen() {
  const state = useTargetPlan();
  const wayRef = parseWayRef(new URLSearchParams(useSearchParams()));

  return (
    <PlanGate state={state} header={<TopBar title={TITLE} />}>
      {(plan, target) => <WayDetail plan={plan} target={target} wayRef={wayRef} />}
    </PlanGate>
  );
}

type WayDetailProps = { plan: PlanResponse; target: PlanTarget; wayRef: WayRef };

function WayDetail({ plan, target, wayRef }: WayDetailProps) {
  const selected = selectWay(plan, wayRef) ?? selectWay(plan, FIRST_WAY);
  if (!selected) {
    return (
      <>
        <TopBar title={TITLE} />
        <NoRouteState />
      </>
    );
  }
  const { way, title } = selected;
  const summary = summarizeWay(way);
  return (
    <>
      <TopBar
        title={title}
        subtitle={`${target.name} → 집 · ${formatKoreaClock(summary.arrive)} 도착`}
      />
      <main className="flex flex-col gap-2 pb-10">
        <div className="flex flex-wrap gap-2 px-5 py-3">
          <Pill tone="neutral" className="text-[13px]">
            {formatDuration(summary.totalMinutes)}
          </Pill>
          <Pill tone="neutral" className="text-[13px]">
            {summary.transfers === 0 ? '환승 없음' : `환승 ${summary.transfers}번`}
          </Pill>
          <Pill tone="neutral" className="text-[13px]">
            걷기 {summary.walkMinutes}분
          </Pill>
        </div>
        <WayTimeline way={way} />
        {hasEstimatedRide(way) && (
          <p className="mx-5 rounded-xl bg-surface p-3.5 text-xs text-muted-foreground">
            추정 — 거리·배차로 계산한 시각이라 실제와 몇 분 다를 수 있어요
          </p>
        )}
      </main>
    </>
  );
}
