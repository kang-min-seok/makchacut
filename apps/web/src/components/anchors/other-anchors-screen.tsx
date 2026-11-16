'use client';

import type { PlanResponse } from '@makchacut/shared';
import { AnchorRowLink } from '@/components/anchors/anchor-row-link';
import { TopBar } from '@/components/layout/top-bar';
import { PlanGate } from '@/components/plan/plan-gate';
import { NoRouteState } from '@/components/plan/plan-states';
import { useTargetPlan } from '@/hooks/use-target-plan';
import { planDetailHref, type PlanTarget } from '@/lib/plan-target';
import { anchorRows } from '@/lib/plan-view';

const TITLE = '다른 막차';

export function OtherAnchorsScreen() {
  const state = useTargetPlan();
  return (
    <PlanGate state={state} header={<TopBar title={TITLE} />}>
      {(plan, target) => <OtherAnchors plan={plan} target={target} />}
    </PlanGate>
  );
}

type OtherAnchorsProps = { plan: PlanResponse; target: PlanTarget };

function OtherAnchors({ plan, target }: OtherAnchorsProps) {
  const rows = anchorRows(plan);
  return (
    <>
      <TopBar title={TITLE} subtitle={`${target.name} → 집`} />
      {rows.length === 0 ? (
        <NoRouteState />
      ) : (
        <main className="flex flex-col gap-2.5 px-5 pt-3 pb-10">
          {rows.map((row) => (
            <AnchorRowLink
              key={`${row.routeName}:${row.stopName}`}
              row={row}
              href={planDetailHref(target, row.ref)}
            />
          ))}
        </main>
      )}
    </>
  );
}
