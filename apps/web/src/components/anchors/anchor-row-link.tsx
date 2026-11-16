import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { RouteChip } from '@/components/transit/route-chip';
import { Pill } from '@/components/ui/pill';
import { formatKoreaClock } from '@/lib/korea-time';
import type { AnchorRow } from '@/lib/plan-view';

type AnchorRowLinkProps = {
  row: AnchorRow;
  href: string;
};

// 다른 막차 목록 한 줄. 누르면 그 막차 기준 경로 상세로 간다.
export function AnchorRowLink({ row, href }: AnchorRowLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <RouteChip step={{ type: row.type, routeName: row.routeName }} size="md" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{row.stopName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-num text-[22px] leading-none font-bold">
            {formatKoreaClock(row.latestDeparture)}
          </span>
          <span className="text-sm text-muted-foreground">까지 출발</span>
          {row.recommended && <Pill tone="primary">추천</Pill>}
          {row.estimated && <Pill tone="warn">추정</Pill>}
        </div>
      </div>
      <span className="flex flex-col items-end">
        <span className="font-num text-lg leading-none font-bold">
          {formatKoreaClock(row.time)}
        </span>
        <span className="text-xs text-muted-foreground">막차</span>
      </span>
      <ChevronRight aria-hidden className="size-[18px] shrink-0 text-subtle-foreground" />
    </Link>
  );
}
