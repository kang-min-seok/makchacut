import { cn } from 'cn';
import type { ReactNode } from 'react';

const ICON_TONES = {
  urgent: 'bg-urgent-soft text-urgent',
  warn: 'bg-warn-soft text-warn',
  neutral: 'bg-surface text-muted-foreground',
} as const;

type StatePanelProps = {
  icon: ReactNode;
  tone: keyof typeof ICON_TONES;
  title: string;
  description?: string;
  children?: ReactNode;
};

// 빈·오류 상태 한 화면: 아이콘, 제목, 설명, 버튼들
export function StatePanel({ icon, tone, title, description, children }: StatePanelProps) {
  return (
    <section
      role="status"
      className="flex flex-col items-center gap-3 px-6 pt-16 pb-10 text-center [&_svg]:size-6"
    >
      <span
        className={cn('flex size-14 items-center justify-center rounded-full', ICON_TONES[tone])}
      >
        {icon}
      </span>
      <h2 className="text-xl leading-snug font-bold whitespace-pre-line">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-2 flex w-full flex-col gap-2">{children}</div>}
    </section>
  );
}
