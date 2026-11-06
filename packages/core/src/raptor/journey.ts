import {
  confidenceAt,
  headwayOf,
  patternStopAt,
  type TimeSource,
  timeIndex,
  timeSourceAt,
  type TransitGraph,
} from '#graph/transit-graph';
import type { Confidence } from '#stop-last/confidence';
import {
  alightLimitOf,
  type ReverseRaptorResult,
  transferSlackOf,
} from '#raptor/reverse-raptor';

export type RideLeg = {
  kind: 'ride';
  pattern: number;
  trip: number;
  fromStop: number;
  toStop: number;
  // 배차 기반이면 최악 대기 뒤 출발(= 정류장 도착 + 배차간격)
  depart: number;
  arrive: number;
  // 배차 기반 탑승이면 배차 간격(분), 막차·열차 시각 그대로면 null
  headwayMinutes: number | null;
  // 탄 정류장 시각의 출처·신뢰도
  timeSource: TimeSource;
  confidence: Confidence;
};

export type WalkLeg = {
  kind: 'walk';
  fromStop: number;
  toStop: number;
  seconds: number;
};

export type JourneyLeg = RideLeg | WalkLeg;

export type Journey = {
  startStop: number;
  // 늦어도 이 시각에 startStop에 있어야 한다
  latestDeparture: number;
  rides: number;
  legs: JourneyLeg[];
  targetStop: number;
};

export type LabelKind = 'ride' | 'walk';
export type Label = { round: number; kind: LabelKind; value: number };

// 배차 기반 구간은 도착을 더하기·빼기로 다시 구해 부동소수 오차가 생길 수 있다
const TIME_EPSILON = 1e-6;

// 이 정류장의 라운드(탄 횟수)별 값. 라운드는 앞 라운드보다 나아진 값만 남기므로 탄 횟수와 마감의 파레토 집합이다.
export function labelsAt(result: ReverseRaptorResult, stop: number): Label[] {
  const labels: Label[] = [];
  result.rounds.forEach((round, roundNumber) => {
    const ride = round.ride[stop]!;
    const walk = round.walk[stop]!;
    if (ride === -Infinity && walk === -Infinity) return;
    // 같은 라운드면 ride(그 자리에서 타기)가 구간이 적다
    const kind: LabelKind = ride >= walk ? 'ride' : 'walk';
    labels.push({ round: roundNumber, kind, value: Math.max(ride, walk) });
  });
  return labels;
}

// 이 정류장의 가장 늦은 값. 같으면 덜 타는 쪽.
export function bestLabelAt(result: ReverseRaptorResult, stop: number): Label | undefined {
  let best: Label | undefined;
  for (const label of labelsAt(result, stop)) {
    if (!best || label.value > best.value) best = label;
  }
  return best;
}

// 이 시각에 내려서 이어 갈 수 있는 가장 적게 타는 라운드의 값
function continuationAfterAlight(
  result: ReverseRaptorResult,
  stop: number,
  arrival: number,
  beforeRound: number,
): Label | undefined {
  for (let roundNumber = 0; roundNumber < beforeRound; roundNumber += 1) {
    const round = result.rounds[roundNumber]!;
    const limit = alightLimitOf(round, roundNumber, stop, result);
    if (arrival > limit + TIME_EPSILON) continue;
    // 바로 갈아타는 쪽이 걷는 쪽보다 구간이 적다
    const slack = transferSlackOf(roundNumber, result);
    const rideFits = arrival <= round.ride[stop]! - slack + TIME_EPSILON;
    return { round: roundNumber, kind: rideFits ? 'ride' : 'walk', value: limit };
  }
  return undefined;
}

function rideLeg(
  graph: TransitGraph,
  result: ReverseRaptorResult,
  round: number,
  stop: number,
): RideLeg {
  const r = result.rounds[round]!;
  const pattern = r.ridePattern[stop]!;
  const trip = r.rideTrip[stop]!;
  const board = r.rideBoardPosition[stop]!;
  const alight = r.rideAlightPosition[stop]!;
  const boardCell = timeIndex(graph, pattern, trip, board);
  const lastDepart = graph.departures[boardCell]!;
  const lastArrive = graph.arrivals[timeIndex(graph, pattern, trip, alight)]!;
  const headway = r.rideByHeadway[stop] === 1 ? (headwayOf(graph, pattern) ?? 0) : null;
  const depart = headway === null ? lastDepart : r.ride[stop]! + headway;
  return {
    kind: 'ride',
    pattern,
    trip,
    fromStop: stop,
    toStop: patternStopAt(graph, pattern, alight),
    depart,
    arrive: depart + (lastArrive - lastDepart),
    headwayMinutes: headway,
    timeSource: timeSourceAt(graph, boardCell),
    confidence: confidenceAt(graph, boardCell),
  };
}

// 출발 정류장의 값(기본: 가장 늦은 값)에서 목적지까지 구간을 따라간다
export function reconstructJourney(
  graph: TransitGraph,
  result: ReverseRaptorResult,
  startStop: number,
  startLabel: Label | undefined = bestLabelAt(result, startStop),
): Journey | undefined {
  const start = startLabel;
  if (!start) return undefined;

  const legs: JourneyLeg[] = [];
  let stop = startStop;
  let label: Label = start;
  for (;;) {
    const round = result.rounds[label.round]!;
    if (label.kind === 'walk') {
      const footpath = round.walkFootpath[stop]!;
      const toStop = graph.footpathTo[footpath]!;
      legs.push({
        kind: 'walk',
        fromStop: stop,
        toStop,
        seconds: graph.footpathSeconds[footpath]! * result.walkTimeFactor,
      });
      stop = toStop;
      label = { round: label.round, kind: 'ride', value: round.ride[toStop]! };
      continue;
    }
    if (label.round === 0) break;
    const leg = rideLeg(graph, result, label.round, stop);
    legs.push(leg);
    const next = continuationAfterAlight(result, leg.toStop, leg.arrive, label.round);
    if (!next) return undefined;
    stop = leg.toStop;
    label = next;
  }

  return {
    startStop,
    latestDeparture: start.value,
    rides: legs.filter((l) => l.kind === 'ride').length,
    legs,
    targetStop: stop,
  };
}
