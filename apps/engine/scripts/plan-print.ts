import type { PlanResponse, PlanWay } from '@makchacut/shared';

// 점검 스크립트 출력용: ISO 시각에서 HH:MM만
export const clockOf = (iso: string) => iso.slice(11, 16);

function stepLines(way: PlanWay): string[] {
  return way.steps.map((step) => {
    const route = step.routeName ? ` [${step.type} ${step.routeName}]` : ` [${step.type}]`;
    const kind = step.type === 'walk' ? '' : ` ${step.timeKind}`;
    return `    ${clockOf(step.depart)} ${step.from} → ${step.to} ${clockOf(step.arrive)}${route}${kind}`;
  });
}

export function planLines(response: PlanResponse): string[] {
  const lines = [`  마감 ${clockOf(response.deadline)}`];
  const { anchor, detour, later, otherAnchors } = response;
  if (anchor) {
    lines.push(
      `  핵심 연결: ${anchor.stopName} ${anchor.routeName} ${clockOf(anchor.time)} (${anchor.source}/${anchor.confidence}, ${anchor.timeKind})`,
    );
  } else {
    lines.push('  핵심 연결: 없음');
  }
  if (detour) {
    lines.push(
      `  돌아가는 막차: 마감 ${clockOf(detour.deadline)} (+${detour.extraMinutes}분 더 걸림)`,
    );
  }
  response.ways.forEach((way, i) => {
    lines.push(`  방법 ${i + 1}: ${clockOf(way.latestDeparture)} 출발`, ...stepLines(way));
  });
  if (later) {
    lines.push(
      `  더 늦은 경로: ${clockOf(later.latestDeparture)} 출발 (환승 +${later.extraTransfers})`,
      ...stepLines(later.way),
    );
  }
  otherAnchors.forEach((other, i) => {
    lines.push(
      `  다른 막차 ${i + 1}: ${other.stopName} ${other.routeName} ${clockOf(other.time)} → ${clockOf(other.latestDeparture)}까지 출발 (${other.source}/${other.confidence}, ${other.timeKind})`,
      ...stepLines(other.way),
    );
  });
  for (const note of response.notes) lines.push(`  ※ ${note}`);
  return lines;
}
