import { patternStopAt, timeIndex, type TransitGraph } from '#graph/transit-graph';
import { alightLimitOf, type ReverseRaptorResult } from '#raptor/reverse-raptor';

export type RideLeg = {
  kind: 'ride';
  pattern: number;
  trip: number;
  fromStop: number;
  toStop: number;
  depart: number;
  arrive: number;
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

type LabelKind = 'ride' | 'walk';
type Label = { round: number; kind: LabelKind; value: number };

// 이 정류장의 가장 늦은 값. 같으면 덜 타는 쪽.
export function bestLabelAt(result: ReverseRaptorResult, stop: number): Label | undefined {
  let best: Label | undefined;
  result.rounds.forEach((round, roundNumber) => {
    for (const kind of ['ride', 'walk'] as const) {
      const value = round[kind][stop]!;
      if (value === -Infinity) continue;
      if (!best || value > best.value) best = { round: roundNumber, kind, value };
    }
  });
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
    const limit = alightLimitOf(round, roundNumber, stop, result.minTransferMinutes);
    if (arrival > limit) continue;
    // 바로 갈아타는 쪽이 걷는 쪽보다 구간이 적다
    const slack = roundNumber === 0 ? 0 : result.minTransferMinutes;
    const rideFits = arrival <= round.ride[stop]! - slack;
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
  return {
    kind: 'ride',
    pattern,
    trip,
    fromStop: stop,
    toStop: patternStopAt(graph, pattern, alight),
    depart: graph.departures[timeIndex(graph, pattern, trip, board)]!,
    arrive: graph.arrivals[timeIndex(graph, pattern, trip, alight)]!,
  };
}

// 출발 정류장의 가장 늦은 값에서 목적지까지 구간을 따라간다
export function reconstructJourney(
  graph: TransitGraph,
  result: ReverseRaptorResult,
  startStop: number,
): Journey | undefined {
  const start = bestLabelAt(result, startStop);
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
        seconds: graph.footpathSeconds[footpath]!,
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
