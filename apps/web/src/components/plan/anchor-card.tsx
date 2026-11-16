import type { PlanAnchor, PlanStep } from '@makchacut/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { RouteChip } from '@/components/transit/route-chip';
import { Pill } from '@/components/ui/pill';
import { ANCHOR_CONFIDENCE_LABELS, ANCHOR_SOURCE_LABELS } from '@/lib/anchor-labels';
import { formatKoreaClock } from '@/lib/korea-time';
import { MODE_LABELS } from '@/lib/plan-view';

// 막차 시각 출처는 개발 중 확인용이라 프로덕션 빌드에서는 숨긴다
const SHOW_DEBUG = process.env.NODE_ENV !== 'production';
const DEFAULT_MODE: Exclude<PlanStep['type'], 'walk'> = 'bus';

type AnchorCardProps = {
  anchor: PlanAnchor;
  step: PlanStep | undefined;
  detailHref: string;
  otherAnchorCount: number;
  anchorsHref: string;
};

// 꼭 타야 하는 막차. 위쪽을 누르면 경로 상세, 다른 막차가 있으면 아래 버튼으로 목록에 간다.
export function AnchorCard({
  anchor,
  step,
  detailHref,
  otherAnchorCount,
  anchorsHref,
}: AnchorCardProps) {
  const type = step && step.type !== 'walk' ? step.type : DEFAULT_MODE;
  return (
    <div className="mx-5 flex flex-col gap-3 rounded-2xl bg-primary-soft p-4">
      <Link
        href={detailHref}
        className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <h2 className="text-[17px] font-bold">이 {MODE_LABELS[type]}를 꼭 타야 집에 가요</h2>
          <div className="flex items-center gap-2.5">
            <RouteChip step={{ type, routeName: anchor.routeName }} size="md" />
            <span className="min-w-0 flex-1 truncate text-base font-medium">{anchor.stopName}</span>
            <span className="flex flex-col items-end">
              <span className="font-num text-2xl leading-none font-bold">
                {formatKoreaClock(anchor.time)}
              </span>
              <span className="text-xs text-muted-foreground">막차</span>
            </span>
          </div>
          {SHOW_DEBUG && (
            <Pill tone="warn" className="self-start">
              DEV · {ANCHOR_SOURCE_LABELS[anchor.source]} ·{' '}
              {ANCHOR_CONFIDENCE_LABELS[anchor.confidence]}
            </Pill>
          )}
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-subtle-foreground" />
      </Link>
      {otherAnchorCount > 0 && (
        <Link
          href={anchorsHref}
          className="flex h-10 items-center justify-center gap-1 rounded-xl bg-background text-sm font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          다른 막차 {otherAnchorCount}개 보기
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}
