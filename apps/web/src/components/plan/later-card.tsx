import type { PlanLater } from '@makchacut/shared';
import { ChevronRight, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { laterHeadline } from '@/lib/later-view';

type LaterCardProps = {
  later: PlanLater;
  detailHref: string;
};

// 환승을 더 하면 더 늦게 나설 수 있는 경로. 누르면 그 경로 상세로 간다.
export function LaterCard({ later, detailHref }: LaterCardProps) {
  return (
    <Link
      href={detailHref}
      className="mx-5 flex items-start gap-3 rounded-2xl bg-surface p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Shuffle aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <div>
        <h2 className="text-[15px] font-bold">{laterHeadline(later)}</h2>
        <p className="text-[13px] text-muted-foreground">
          갈아타는 곳이 늘어 연결 하나만 어긋나도 집에 못 갈 수 있어요.
        </p>
      </div>
      <ChevronRight aria-hidden className="ml-auto size-[18px] shrink-0 text-subtle-foreground" />
    </Link>
  );
}
