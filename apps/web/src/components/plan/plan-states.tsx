import { House, Link2Off, Moon, RotateCcw, Route, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { StatePanel } from '@/components/state/state-panel';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKoreaClock, formatDuration } from '@/lib/korea-time';
import { HOME_PATH } from '@/lib/routes';

export function PlanLoading() {
  return (
    <main aria-busy className="flex flex-col gap-3 px-5 pt-3">
      <p className="text-sm text-muted-foreground">막차를 거꾸로 계산하고 있어요…</p>
      <Skeleton className="h-16 w-44" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </main>
  );
}

const homeLink = (label: string, variant: 'outline' | 'ghost' | 'default') => (
  <Link href={HOME_PATH} className={buttonVariants({ variant, size: 'xl' })}>
    {label}
  </Link>
);

type MissedStateProps = { deadline: string; minutesPast: number; tomorrowHref: string };

export function MissedState({ deadline, minutesPast, tomorrowHref }: MissedStateProps) {
  return (
    <StatePanel
      icon={<Moon aria-hidden />}
      tone="urgent"
      title={'오늘은 대중교통으로\n집에 갈 수 없어요'}
      description={`마지막 출발 시각 ${formatKoreaClock(deadline)}이 ${formatDuration(minutesPast)} 지났어요.`}
    >
      <Link href={tomorrowHref} className={buttonVariants({ variant: 'outline', size: 'xl' })}>
        내일 기준으로 보기
      </Link>
      {homeLink('다른 약속 장소 찾기', 'ghost')}
    </StatePanel>
  );
}

export function NoRouteState() {
  return (
    <StatePanel
      icon={<Route aria-hidden />}
      tone="neutral"
      title="집에 가는 경로를 찾지 못했어요"
      description="약속 장소나 집 근처에 탈 수 있는 정류장·역이 없을 수 있어요. 가까운 역이나 큰길로 다시 찾아보세요."
    >
      {homeLink('다른 약속 장소 찾기', 'outline')}
    </StatePanel>
  );
}

export function UnavailableState({ onRetry }: { onRetry: () => void }) {
  return (
    <StatePanel
      icon={<TriangleAlert aria-hidden />}
      tone="warn"
      title="지금은 계산할 수 없어요"
      description="잠시 뒤 다시 시도해 주세요. 계속되면 데이터 갱신 중일 수 있어요."
    >
      <Button size="xl" onClick={onRetry}>
        <RotateCcw aria-hidden />
        다시 시도
      </Button>
    </StatePanel>
  );
}

export function InvalidTargetState() {
  return (
    <StatePanel
      icon={<Link2Off aria-hidden />}
      tone="neutral"
      title="약속 장소 정보가 없어요"
      description="주소가 잘렸거나 바뀐 것 같아요. 홈에서 다시 검색해 주세요."
    >
      {homeLink('홈으로', 'default')}
    </StatePanel>
  );
}

export function NeedHomeState({ registerHref }: { registerHref: string }) {
  return (
    <StatePanel
      icon={<House aria-hidden />}
      tone="neutral"
      title="집을 먼저 등록해 주세요"
      description="집 기준으로 막차를 계산해요. 위치는 이 기기에만 저장돼요."
    >
      <Link href={registerHref} className={buttonVariants({ size: 'xl' })}>
        집 등록하기
      </Link>
    </StatePanel>
  );
}
