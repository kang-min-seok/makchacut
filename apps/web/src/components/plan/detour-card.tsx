import type { PlanResponse } from '@makchacut/shared';
import { Route } from 'lucide-react';
import { formatKoreaClock, minutesBetween } from '@/lib/korea-time';

type DetourCardProps = {
  deadline: string;
  detour: NonNullable<PlanResponse['detour']>;
};

// 돌아가는 막차: 더 늦게 나서도 되지만 이동이 더 걸린다 (경로 단계는 응답에 없음)
export function DetourCard({ deadline, detour }: DetourCardProps) {
  const later = minutesBetween(deadline, detour.deadline);
  if (later <= 0) return null;
  return (
    <section className="mx-5 flex items-start gap-3 rounded-2xl bg-surface p-4">
      <Route aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <div>
        <h2 className="text-[15px] font-bold">
          돌아가는 막차는 {formatKoreaClock(detour.deadline)} 출발
        </h2>
        <p className="text-[13px] text-muted-foreground">
          {later}분 더 늦게 나와도 되지만, 길이 돌아가서 이동이 {detour.extraMinutes}분 더 걸려요.
        </p>
      </div>
    </section>
  );
}
