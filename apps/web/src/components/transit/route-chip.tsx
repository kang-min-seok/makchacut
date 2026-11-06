import type { PlanStep } from '@makchacut/shared';
import { cn } from 'cn';
import { routeColorClass, routeLabel } from '@/lib/route-style';

type RouteChipProps = {
  step: Pick<PlanStep, 'type' | 'routeName'>;
  size?: 'sm' | 'md';
};

export function RouteChip({ step, size = 'sm' }: RouteChipProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 font-num font-bold text-transit-on',
        size === 'md' ? 'py-0.5 text-[15px]' : 'py-px text-[13px]',
        routeColorClass(step),
      )}
    >
      {routeLabel(step)}
    </span>
  );
}
