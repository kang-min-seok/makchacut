import type { PlanWay } from '@makchacut/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { StepSummary } from '@/components/plan/step-summary';
import { Pill } from '@/components/ui/pill';
import { formatKoreaClock } from '@/lib/korea-time';
import { firstRideOf, hasEstimatedRide, stepsToAnchor } from '@/lib/plan-view';
import { routeLabel } from '@/lib/route-style';

type WayCardProps = {
  way: PlanWay;
  latest: boolean;
  href: string;
};

export function WayCard({ way, latest, href }: WayCardProps) {
  const firstRide = firstRideOf(way);
  return (
    <Link
      href={href}
      className="flex flex-col gap-2.5 rounded-2xl border border-border p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-center gap-2">
        <span className="font-num text-[22px] leading-none font-bold">
          {formatKoreaClock(way.latestDeparture)}
        </span>
        <span className="text-sm text-muted-foreground">출발</span>
        {latest && <Pill tone="primary">가장 늦게</Pill>}
        {hasEstimatedRide(way) && <Pill tone="warn">추정 포함</Pill>}
        <ChevronRight aria-hidden className="ml-auto size-[18px] text-subtle-foreground" />
      </div>
      <StepSummary steps={stepsToAnchor(way)} />
      {firstRide && (
        <p className="text-[13px] text-muted-foreground">
          {firstRide.from}에서 {routeLabel(firstRide)}
        </p>
      )}
    </Link>
  );
}
