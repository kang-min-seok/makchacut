import type { PlanResponse } from '@makchacut/shared';
import { AnchorCard } from '@/components/plan/anchor-card';
import { DeadlineHero } from '@/components/plan/deadline-hero';
import { DetourCard } from '@/components/plan/detour-card';
import { PlanNotes } from '@/components/plan/plan-notes';
import { WayCard } from '@/components/plan/way-card';
import { planDetailHref, type PlanTarget } from '@/lib/plan-target';
import { anchorStepOf, hasWaysToAnchor } from '@/lib/plan-view';

type PlanResultProps = {
  target: PlanTarget;
  plan: PlanResponse;
  minutesLeft: number | null;
};

export function PlanResult({ target, plan, minutesLeft }: PlanResultProps) {
  const { anchor } = plan;
  return (
    <main className="flex flex-col gap-4 pb-10">
      <DeadlineHero meetupName={target.name} deadline={plan.deadline} minutesLeft={minutesLeft} />
      {anchor && (
        <AnchorCard
          anchor={anchor}
          step={anchorStepOf(plan.ways[0])}
          detailHref={planDetailHref(target, 0)}
        />
      )}
      {anchor && hasWaysToAnchor(plan) && (
        <section className="flex flex-col gap-3 px-5 pt-3" aria-labelledby="ways-title">
          <h2 id="ways-title" className="text-lg font-bold">
            {anchor.stopName}까지 가는 방법
          </h2>
          {plan.ways.map((way, i) => (
            <WayCard
              key={way.latestDeparture + i}
              way={way}
              latest={i === 0 && plan.ways.length > 1}
              href={planDetailHref(target, i)}
            />
          ))}
        </section>
      )}
      {plan.detour && <DetourCard deadline={plan.deadline} detour={plan.detour} />}
      <PlanNotes notes={plan.notes} />
    </main>
  );
}
