import { Clock } from 'lucide-react';
import { Pill } from '@/components/ui/pill';
import { formatDuration } from '@/lib/korea-time';
import { countdownTone } from '@/lib/plan-view';

export function CountdownChip({ minutesLeft }: { minutesLeft: number }) {
  const tone = countdownTone(minutesLeft) === 'urgent' ? 'urgent' : 'primary';
  return (
    <Pill tone={tone} icon={<Clock aria-hidden />} className="text-[13px]">
      {formatDuration(minutesLeft)} 남았어요
    </Pill>
  );
}
