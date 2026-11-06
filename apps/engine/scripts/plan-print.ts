import type { PlanResponse } from '@makchacut/shared';

// 점검 스크립트 출력용: ISO 시각에서 HH:MM만
export const clockOf = (iso: string) => iso.slice(11, 16);

export function planLines(response: PlanResponse): string[] {
  const lines = [`  마감 ${clockOf(response.deadline)}`];
  const { anchor, detour } = response;
  if (anchor) {
    lines.push(
      `  핵심 연결: ${anchor.stopName} ${anchor.routeName} ${clockOf(anchor.time)} (${anchor.source}/${anchor.confidence}, ${anchor.timeKind})`,
    );
  } else {
    lines.push('  핵심 연결: 없음');
  }
  if (detour) {
    lines.push(`  돌아가는 막차: 마감 ${clockOf(detour.deadline)} (+${detour.extraMinutes}분 더 걸림)`);
  }
  response.ways.forEach((way, i) => {
    lines.push(`  방법 ${i + 1}: ${clockOf(way.latestDeparture)} 출발`);
    for (const step of way.steps) {
      const route = step.routeName ? ` [${step.type} ${step.routeName}]` : ` [${step.type}]`;
      const kind = step.type === 'walk' ? '' : ` ${step.timeKind}`;
      lines.push(
        `    ${clockOf(step.depart)} ${step.from} → ${step.to} ${clockOf(step.arrive)}${route}${kind}`,
      );
    }
  });
  for (const note of response.notes) lines.push(`  ※ ${note}`);
  return lines;
}
