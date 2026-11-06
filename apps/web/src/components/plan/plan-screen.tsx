'use client';

import { addDays } from '@makchacut/core';
import { TopBar } from '@/components/layout/top-bar';
import { SettingsLink } from '@/components/layout/settings-link';
import { PlanGate } from '@/components/plan/plan-gate';
import { PlanResult } from '@/components/plan/plan-result';
import { MissedState } from '@/components/plan/plan-states';
import { useNow } from '@/hooks/use-now';
import { useServiceToday } from '@/hooks/use-service-today';
import { useTargetPlan } from '@/hooks/use-target-plan';
import { minutesUntil } from '@/lib/korea-time';
import { planHref } from '@/lib/plan-target';
import { planDateLine, planTitle } from '@/lib/plan-title';

const FALLBACK_TITLE = '막차 계산';

export function PlanScreen() {
  const state = useTargetPlan();
  const today = useServiceToday();
  const now = useNow();
  const target = state.status === 'invalid' ? null : state.target;
  const plan = state.status === 'ready' ? state.query.data : undefined;

  const header = (
    <TopBar
      title={target ? planTitle(target) : FALLBACK_TITLE}
      subtitle={target ? planDateLine(target, plan?.dayType) : undefined}
      action={<SettingsLink />}
    />
  );

  return (
    <PlanGate state={state} header={header}>
      {(result, resultTarget) => {
        const minutesLeft = minutesUntil(result.deadline, now);
        return (
          <>
            {header}
            {minutesLeft < 0 ? (
              <MissedState
                deadline={result.deadline}
                minutesPast={-minutesLeft}
                tomorrowHref={planHref({
                  ...resultTarget,
                  date: addDays(today ?? resultTarget.date, 1),
                })}
              />
            ) : (
              <PlanResult
                target={resultTarget}
                plan={result}
                minutesLeft={resultTarget.date === today ? minutesLeft : null}
              />
            )}
          </>
        );
      }}
    </PlanGate>
  );
}
