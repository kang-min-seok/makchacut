import { isPassingStop } from '#transit/passing-stop';

export type ObservedStop = {
  seq: number;
  name: string;
};

export type CleanedLast = {
  lastMinutes: number;
  // 버린 값·빈 값을 앞뒤 값으로 채웠다
  interpolated: boolean;
};

// 가장 긴 비감소 부분수열의 인덱스. 앞 정류장보다 이른 값(역전)을 최소한으로 버린다.
function longestNonDecreasing(values: readonly number[]): number[] {
  const length = values.map(() => 1);
  const prev = values.map(() => -1);
  values.forEach((value, i) => {
    for (let j = 0; j < i; j += 1) {
      const before = values[j];
      const lengthJ = length[j];
      if (before === undefined || lengthJ === undefined) continue;
      if (before <= value && lengthJ + 1 > (length[i] ?? 0)) {
        length[i] = lengthJ + 1;
        prev[i] = j;
      }
    }
  });
  let end = 0;
  length.forEach((l, i) => {
    if (l > (length[end] ?? 0)) end = i;
  });
  const kept: number[] = [];
  for (let i = values.length > 0 ? end : -1; i >= 0; i = prev[i] ?? -1) kept.unshift(i);
  return kept;
}

// 서울 API 정류장별 막차(lastTm) 정제 (M0 4108):
// 통과 정류장((미정차) 등)은 빼고, 기점 막차보다 이른 값과 역전된 값은 버린 뒤 앞뒤 값 사이를 정류장 순서로 보간한다.
// 처음·마지막 관측값 바깥은 채우지 않는다.
export function cleanObservedLast(
  stops: readonly ObservedStop[],
  observed: ReadonlyMap<number, number>,
  lastAtOrigin: number | null,
): Map<number, CleanedLast> {
  const boardable = stops.filter((stop) => !isPassingStop(stop.name));
  const candidates = boardable.flatMap((stop, position) => {
    const minutes = observed.get(stop.seq);
    if (minutes === undefined || (lastAtOrigin !== null && minutes < lastAtOrigin)) return [];
    return [{ position, minutes }];
  });
  const kept = longestNonDecreasing(candidates.map((c) => c.minutes)).flatMap((i) => {
    const candidate = candidates[i];
    return candidate ? [candidate] : [];
  });

  const result = new Map<number, CleanedLast>();
  kept.forEach((anchor, k) => {
    const stop = boardable[anchor.position];
    if (stop) result.set(stop.seq, { lastMinutes: anchor.minutes, interpolated: false });
    const next = kept[k + 1];
    if (!next) return;
    const span = next.position - anchor.position;
    for (let position = anchor.position + 1; position < next.position; position += 1) {
      const between = boardable[position];
      if (!between) continue;
      const fraction = (position - anchor.position) / span;
      result.set(between.seq, {
        lastMinutes: anchor.minutes + (next.minutes - anchor.minutes) * fraction,
        interpolated: true,
      });
    }
  });
  return result;
}
