import type { PlanStep, PlanWay } from '@makchacut/shared';
import { cn } from 'cn';
import { RouteChip } from '@/components/transit/route-chip';
import { Pill } from '@/components/ui/pill';
import { formatKoreaClock } from '@/lib/korea-time';
import { stepMinutes } from '@/lib/plan-view';
import { routeColorClass } from '@/lib/route-style';

type RowProps = {
  time: string;
  dotClass: string;
  lineClass?: string;
  children: React.ReactNode;
};

function TimelineRow({ time, dotClass, lineClass, children }: RowProps) {
  return (
    <li className="flex gap-3">
      <span className="w-11 shrink-0 pt-px font-num text-sm font-semibold">{time}</span>
      <span aria-hidden className="flex w-3 shrink-0 flex-col items-center gap-1 pt-1.5">
        <span className={cn('size-3 shrink-0 rounded-full', dotClass)} />
        {lineClass && <span className={cn('w-0.5 flex-1 rounded-full', lineClass)} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pb-5">{children}</div>
    </li>
  );
}

function StepContent({ step }: { step: PlanStep }) {
  const minutes = <p className="text-[13px] text-muted-foreground">{stepMinutes(step)}분</p>;
  if (step.type === 'walk') {
    return (
      <>
        <p className="text-[15px] font-bold">{step.to}까지 걷기</p>
        {minutes}
      </>
    );
  }
  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
        <RouteChip step={step} />
        <span>
          {step.from} → {step.to}
        </span>
        {step.isAnchor && <Pill tone="primary">막차</Pill>}
        {step.timeKind === 'estimated' && <Pill tone="warn">추정</Pill>}
      </p>
      {minutes}
    </>
  );
}

export function WayTimeline({ way }: { way: PlanWay }) {
  const last = way.steps.at(-1);
  return (
    <ol className="px-5 pt-2">
      {way.steps.map((step, i) => {
        const ride = step.type !== 'walk';
        const color = ride ? routeColorClass(step) : 'bg-muted-foreground';
        return (
          <TimelineRow
            key={`${step.depart}-${i}`}
            time={formatKoreaClock(step.depart)}
            dotClass={color}
            lineClass={ride ? cn(color, 'w-1') : 'bg-border'}
          >
            <StepContent step={step} />
          </TimelineRow>
        );
      })}
      {last && (
        <TimelineRow time={formatKoreaClock(last.arrive)} dotClass="bg-foreground">
          <p className="text-[15px] font-bold">집 도착</p>
        </TimelineRow>
      )}
    </ol>
  );
}
