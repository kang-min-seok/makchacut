import type { PlanStep } from '@makchacut/shared';
import { ChevronRight, Footprints } from 'lucide-react';
import { Fragment } from 'react';
import { RouteChip } from '@/components/transit/route-chip';
import { stepMinutes } from '@/lib/plan-view';

// "걷기 2분 › 340 › 6003" 한 줄
export function StepSummary({ steps }: { steps: readonly PlanStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, i) => (
        <Fragment key={`${step.depart}-${i}`}>
          {i > 0 && <ChevronRight aria-hidden className="size-3.5 text-subtle-foreground" />}
          {step.type === 'walk' ? (
            <span className="inline-flex items-center gap-0.5 text-[13px] font-medium text-muted-foreground">
              <Footprints aria-label="걷기" className="size-[15px]" />
              {stepMinutes(step)}분
            </span>
          ) : (
            <RouteChip step={step} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
