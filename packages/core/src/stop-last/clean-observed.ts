import { distanceMeters, hasCoordinates } from '#geo/distance';
import { MAX_SPEED_METERS_PER_MINUTE } from '#geo/max-speed';
import { unfoldServiceMinutes } from '#time/service-day';
import { isPassingStop } from '#transit/passing-stop';

export type ObservedStop = {
  seq: number;
  name: string;
  lat: number | null;
  lng: number | null;
};

// lastTm은 분 단위라 가까운 정류장끼리 같은 분이 나온다
const ROUNDING_SLACK_MINUTES = 1;

type Candidate = { stop: ObservedStop; position: number; minutes: number };

// 앞 관측 뒤에 이 관측이 올 수 있는가: 시각이 같거나 늦고, 그 사이 거리를 갈 시간이 있다 (N61 건대→강남 1분 같은 값을 거른다)
function canFollow(before: Candidate, after: Candidate): boolean {
  const elapsed = after.minutes - before.minutes;
  if (elapsed < 0) return false;
  if (!hasCoordinates(before.stop) || !hasCoordinates(after.stop)) return true;
  const minMinutes = distanceMeters(before.stop, after.stop) / MAX_SPEED_METERS_PER_MINUTE;
  return elapsed + ROUNDING_SLACK_MINUTES >= minMinutes;
}

// 정류장 seq → 노선 처음부터 쌓인 값(소요·거리). 보간 구간 비율에 쓴다. 모르면 undefined.
export type StopWeight = (seq: number) => number | undefined;

// 직선거리 누적(m). 좌표 없는 정류장부터 뒤는 모른다.
function cumulativeMeters(stops: readonly ObservedStop[]): StopWeight {
  const meters = new Map<number, number>();
  let total = 0;
  for (const [index, stop] of stops.entries()) {
    const prev = stops[index - 1];
    if (!hasCoordinates(stop)) break;
    if (prev) {
      if (!hasCoordinates(prev)) break;
      total += distanceMeters(prev, stop);
    }
    meters.set(stop.seq, total);
  }
  return (seq) => meters.get(seq);
}

// 앞 관측~뒤 관측 사이 정류장들이 차지하는 비율. 값이 비거나 단조가 아니면 undefined.
function shareOf(weight: StopWeight, seqs: readonly number[]): number[] | undefined {
  const values = seqs.map(weight);
  const first = values[0];
  const last = values[values.length - 1];
  if (first === undefined || last === undefined || last <= first) return undefined;
  const shares: number[] = [];
  let previous = first;
  for (const value of values.slice(1)) {
    if (value === undefined || value < previous) return undefined;
    shares.push((value - first) / (last - first));
    previous = value;
  }
  return shares.slice(0, -1);
}

export type CleanedLast = {
  lastMinutes: number;
  // 버린 값·빈 값을 앞뒤 값으로 채웠다
  interpolated: boolean;
};

// 서로 이어질 수 있는 관측의 가장 긴 부분수열 인덱스. 역전·불가능하게 짧은 구간을 최소한으로 버린다.
function longestFeasibleChain(values: readonly Candidate[]): number[] {
  const length = values.map(() => 1);
  const prev = values.map(() => -1);
  values.forEach((value, i) => {
    for (let j = 0; j < i; j += 1) {
      const before = values[j];
      const lengthJ = length[j];
      if (before === undefined || lengthJ === undefined) continue;
      if (canFollow(before, value) && lengthJ + 1 > (length[i] ?? 0)) {
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
// 통과 정류장((미정차) 등)은 빼고, 04시 경계에서 아침으로 접힌 심야 값은 펴고,
// 기점 막차보다 이른 값과 역전·불가능하게 짧은 구간의 값은 버린 뒤 앞뒤 값 사이를 보간한다.
// 보간 비율: 주어진 구간 소요(travelWeight) → 직선거리 누적 → 정류장 순번. 도심 정류장 뒤 고속 구간이 오면 순번 비례로는 도심 막차가 늦어진다 (8501).
// 처음·마지막 관측값 바깥은 채우지 않는다.
export function cleanObservedLast(
  stops: readonly ObservedStop[],
  observed: ReadonlyMap<number, number>,
  lastAtOrigin: number | null,
  travelWeight?: StopWeight,
): Map<number, CleanedLast> {
  const boardable = stops.filter((stop) => !isPassingStop(stop.name));
  const candidates = boardable.flatMap((stop, position): Candidate[] => {
    const raw = observed.get(stop.seq);
    if (raw === undefined) return [];
    const minutes = lastAtOrigin === null ? raw : unfoldServiceMinutes(raw, lastAtOrigin);
    if (lastAtOrigin !== null && minutes < lastAtOrigin) return [];
    return [{ stop, position, minutes }];
  });
  const kept = longestFeasibleChain(candidates).flatMap((i) => {
    const candidate = candidates[i];
    return candidate ? [candidate] : [];
  });

  const weights = [travelWeight, cumulativeMeters(stops)].filter(
    (weight): weight is StopWeight => weight !== undefined,
  );
  const result = new Map<number, CleanedLast>();
  kept.forEach((anchor, k) => {
    result.set(anchor.stop.seq, { lastMinutes: anchor.minutes, interpolated: false });
    const next = kept[k + 1];
    if (!next) return;
    const span = boardable.slice(anchor.position, next.position + 1);
    const seqs = span.map((stop) => stop.seq);
    const shares =
      weights.map((weight) => shareOf(weight, seqs)).find((found) => found !== undefined) ??
      seqs.slice(1, -1).map((_, i) => (i + 1) / (seqs.length - 1));
    shares.forEach((share, i) => {
      const between = span[i + 1];
      if (!between) return;
      result.set(between.seq, {
        lastMinutes: anchor.minutes + (next.minutes - anchor.minutes) * share,
        interpolated: true,
      });
    });
  });
  return result;
}
