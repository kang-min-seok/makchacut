// 라운드(= 탄 횟수) 하나의 정류장별 값.
// - ride: 이 정류장에서 차를 타서(라운드 0은 목적지 자체) 정해진 값 = 그 차의 출발 시각
// - walk: 이 정류장에서 걸어서 ride 값이 있는 정류장으로 가서 정해진 값

export const NONE = -1;

export type RaptorRound = {
  ride: Float64Array;
  walk: Float64Array;
  ridePattern: Int32Array;
  rideTrip: Int32Array;
  rideBoardPosition: Int32Array;
  rideAlightPosition: Int32Array;
  // 1이면 배차 기반 탑승 (rideTrip은 구간 소요로 쓴 막차 운행)
  rideByHeadway: Uint8Array;
  walkFootpath: Int32Array;
  // 라운드 1부터: 그 값에 이 정류장에 있으면 목적지에 닿는 시각
  rideFinish: Float64Array;
  walkFinish: Float64Array;
};

export type TransferSlack = {
  minTransferMinutes: number;
  targetTransferMinutes: number;
};

export function createRound(size: number): RaptorRound {
  return {
    ride: new Float64Array(size).fill(-Infinity),
    walk: new Float64Array(size).fill(-Infinity),
    ridePattern: new Int32Array(size).fill(NONE),
    rideTrip: new Int32Array(size).fill(NONE),
    rideBoardPosition: new Int32Array(size).fill(NONE),
    rideAlightPosition: new Int32Array(size).fill(NONE),
    rideByHeadway: new Uint8Array(size),
    walkFootpath: new Int32Array(size).fill(NONE),
    rideFinish: new Float64Array(size).fill(Infinity),
    walkFinish: new Float64Array(size).fill(Infinity),
  };
}

// 이 라운드의 ride 값에 차로 내려 이어 탈 때 빼는 여유 (라운드 0은 목적지)
export function transferSlackOf(roundNumber: number, slack: TransferSlack): number {
  return roundNumber === 0 ? slack.targetTransferMinutes : slack.minTransferMinutes;
}

// 이 정류장에서 내려도 되는 가장 늦은 도착 시각 (이 라운드 값 기준)
export function alightLimitOf(
  round: RaptorRound,
  roundNumber: number,
  stop: number,
  slack: TransferSlack,
): number {
  return Math.max(round.walk[stop]!, round.ride[stop]! - transferSlackOf(roundNumber, slack));
}
