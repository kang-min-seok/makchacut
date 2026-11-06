import { CountdownChip } from '@/components/plan/countdown-chip';
import { formatKoreaClock } from '@/lib/korea-time';

type DeadlineHeroProps = {
  meetupName: string;
  deadline: string;
  // 오늘 날짜일 때만 남은 시간을 보여 준다
  minutesLeft: number | null;
};

export function DeadlineHero({ meetupName, deadline, minutesLeft }: DeadlineHeroProps) {
  return (
    <section className="flex flex-col items-start gap-1 px-5 pt-3 pb-5">
      <p className="text-[15px] text-muted-foreground">늦어도 이때 {meetupName}에서 출발하세요</p>
      <p className="flex items-baseline gap-2">
        <span className="font-num text-[68px] leading-none font-bold tracking-tighter">
          {formatKoreaClock(deadline)}
        </span>
        <span className="text-[22px] font-bold">출발</span>
      </p>
      {minutesLeft !== null && <CountdownChip minutesLeft={minutesLeft} />}
    </section>
  );
}
