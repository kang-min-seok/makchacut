// 정류장 목록에 섞여 나오는 통과 지점. GBIS는 (경유), 서울은 (미정차)·(가상)을 붙인다. 타고 내릴 수 없다.
const PASSING_STOP_PATTERN = /\((경유|미정차|가상)\)\s*$/;

export function isPassingStop(name: string): boolean {
  return PASSING_STOP_PATTERN.test(name);
}
