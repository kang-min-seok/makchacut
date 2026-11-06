'use client';

import { addDays } from '@makchacut/core';
import { cn } from 'cn';
import { DAY_TYPE_LABELS, dayOfMonth, guessDayType, monthOf, weekdayOf } from '@/lib/korea-time';

const DAYS_SHOWN = 7;
const SUNDAY = '일';

type WeekCalendarProps = {
  // 운행 기준 오늘
  today: string;
  value: string;
  onChange: (date: string) => void;
};

// 오늘부터 7일만 고를 수 있는 날짜 줄
export function WeekCalendar({ today, value, onChange }: WeekCalendarProps) {
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i));

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="week-calendar-title">
      <div className="flex items-baseline justify-between">
        <h2 id="week-calendar-title" className="text-[15px] font-bold">
          언제 만나요?
        </h2>
        <span className="text-[13px] text-subtle-foreground">{monthOf(value)}월</span>
      </div>
      <div role="radiogroup" aria-labelledby="week-calendar-title" className="flex gap-1">
        {days.map((day) => {
          const selected = day === value;
          const weekday = weekdayOf(day);
          return (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${monthOf(day)}월 ${dayOfMonth(day)}일 ${weekday}요일`}
              onClick={() => onChange(day)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                selected ? 'bg-primary text-primary-foreground' : 'hover:bg-surface',
              )}
            >
              <span
                className={cn(
                  'text-xs',
                  selected
                    ? 'font-bold'
                    : weekday === SUNDAY
                      ? 'text-urgent'
                      : 'text-muted-foreground',
                )}
              >
                {day === today ? '오늘' : weekday}
              </span>
              <span className="font-num text-lg font-semibold">{dayOfMonth(day)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-subtle-foreground">
        {weekdayOf(value)}요일 · {DAY_TYPE_LABELS[guessDayType(value)]} 시간표로 계산해요
      </p>
    </section>
  );
}
