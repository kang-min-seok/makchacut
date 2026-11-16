import type { PlanLater } from '@makchacut/shared';
import { formatKoreaClock } from '@/lib/korea-time';

const COUNT_WORDS: Readonly<Record<number, string>> = { 1: '한', 2: '두', 3: '세' };

function timesLabel(count: number): string {
  const word = COUNT_WORDS[count];
  return word ? `${word} 번` : `${count}번`;
}

// 더 늦은 경로 카드 제목: 환승을 한 번 더 하면 00:50에 나서도 돼요
export function laterHeadline(later: PlanLater): string {
  const clock = formatKoreaClock(later.latestDeparture);
  return `환승을 ${timesLabel(later.extraTransfers)} 더 하면 ${clock}에 나서도 돼요`;
}
