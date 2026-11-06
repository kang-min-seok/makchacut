import type { PlanStep } from '@makchacut/shared';

// 노선 칩 색과 표시 이름. 버스는 노선 유형이 응답에 없어 한 색으로 둔다.

const LINE_CLASSES = [
  'bg-line-1',
  'bg-line-2',
  'bg-line-3',
  'bg-line-4',
  'bg-line-5',
  'bg-line-6',
  'bg-line-7',
  'bg-line-8',
  'bg-line-9',
] as const;

const SEOUL_LINE = /^0?([1-9])호선$/;

export function routeLabel(step: Pick<PlanStep, 'type' | 'routeName'>): string {
  const name = step.routeName ?? '';
  const line = SEOUL_LINE.exec(name);
  return line ? `${line[1]}호선` : name;
}

export function routeColorClass(step: Pick<PlanStep, 'type' | 'routeName'>): string {
  if (step.type === 'bus') return 'bg-transit-bus';
  const line = SEOUL_LINE.exec(step.routeName ?? '');
  return line ? LINE_CLASSES[Number(line[1]) - 1]! : 'bg-transit-subway';
}
