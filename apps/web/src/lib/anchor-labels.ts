import type { AnchorConfidence, AnchorSource } from '@makchacut/shared';

export const ANCHOR_SOURCE_LABELS: Readonly<Record<AnchorSource, string>> = {
  seoul_api: '서울시 정류장별 막차',
  gbis_eta: '경기 회차점 막차 + 구간 소요',
  distance: '거리로 추정',
  timetable: '열차 시간표',
};

export const ANCHOR_CONFIDENCE_LABELS: Readonly<Record<AnchorConfidence, string>> = {
  high: '정확',
  medium: '대체로 정확',
  low: '추정',
};
