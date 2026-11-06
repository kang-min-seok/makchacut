'use client';

import { cn } from 'cn';

export type SegmentedOption<T extends string | number> = { value: T; label: string };

type SegmentedControlProps<T extends string | number> = {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

// 라디오 그룹 의미의 세그먼트 버튼
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-xl bg-surface p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-lg px-1 py-2 text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              selected && 'bg-background font-bold text-foreground shadow-xs ring-1 ring-border',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
