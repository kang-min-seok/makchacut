import { House } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Place } from '@/lib/place';
import { homeRegisterHref, HOME_PATH } from '@/lib/routes';

type HomeSummaryProps = {
  // undefined = 아직 저장소를 읽지 않음
  home: Place | null | undefined;
};

// 저장된 집 한 줄, 없으면 등록 안내 카드
export function HomeSummary({ home }: HomeSummaryProps) {
  if (home === undefined) return <Skeleton className="h-12 w-full rounded-xl" />;
  if (home === null) return <HomeRegisterCard />;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-surface px-3.5 py-3">
      <House aria-hidden className="size-[18px] text-muted-foreground" />
      <span className="text-[13px] text-subtle-foreground">집</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{home.name}</span>
      <Link href={homeRegisterHref(HOME_PATH)} className="text-sm font-medium text-primary">
        변경
      </Link>
    </div>
  );
}

function HomeRegisterCard() {
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl bg-primary-soft p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background">
          <House aria-hidden className="size-5 text-primary" />
        </span>
        <div>
          <h2 className="text-base font-bold">집을 먼저 등록해 주세요</h2>
          <p className="text-[13px] text-muted-foreground">
            집 기준으로 막차를 계산해요. 위치는 이 기기에만 저장돼요.
          </p>
        </div>
      </div>
      <Link href={homeRegisterHref(HOME_PATH)} className={buttonVariants({ size: 'xl' })}>
        집 등록하기
      </Link>
    </section>
  );
}
