import { cn } from 'cn';
import type { ReactNode } from 'react';

const TONES = {
  primary: 'bg-primary-soft text-primary',
  urgent: 'bg-urgent-soft text-urgent',
  warn: 'bg-warn-soft text-warn',
  neutral: 'bg-surface text-muted-foreground',
} as const;

type PillProps = {
  tone: keyof typeof TONES;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Pill({ tone, icon, children, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
