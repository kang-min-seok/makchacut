import type { PlanLater } from '@makchacut/shared';
import type { ReactNode } from 'react';

type LaterCardProps = {
  later: PlanLater;
  detailHref: string;
};

// 환승을 더 하면 더 늦게 나설 수 있는 경로. 누르면 그 경로 상세로 간다.
// shortcut: 응답에 값이 아직 없어 그리지 않는다, 단순한 경로 우선(계획 7)에서 카드 모양을 채운다
export const LaterCard: (props: LaterCardProps) => ReactNode = () => null;
