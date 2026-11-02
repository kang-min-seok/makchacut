// 중앙차로 표시 "(중)"과 공백은 출처마다 달리 붙어 비교에서 뺀다
const MEDIAN_LANE_SUFFIX = /\(중\)\s*$/;
const WHITESPACE = /\s+/g;

export function normalizeStopName(name: string): string {
  return name.trim().replace(MEDIAN_LANE_SUFFIX, '').replace(WHITESPACE, '');
}
