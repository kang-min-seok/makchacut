import {
  fetchSeoulSubwayStations,
  pickSubwayPlace,
  searchKakaoSubwayPlaces,
  subwayStationQuery,
} from '@makchacut/data';
import type { ComputeResult, ComputeStepRunner } from '#compute/compute-step';
import {
  loadSubwayStopsWithoutCoords,
  type StopCoords,
  updateStopCoords,
} from '#compute/stores/stop-coords-store';
import { ApiBudget, QuotaExhaustedError } from '#jobs/api-budget';

// 카카오 로컬 무료 한도(하루 10만 건)보다 훨씬 작게 묶는다. 역은 459개다.
const MAX_CALLS_PER_RUN = 1000;
const MAX_MISSING_SAMPLES = 10;

// 좌표가 없는 서울 지하철역을 카카오 키워드 검색(역명 + 호선)으로 채운다. 이미 채운 역은 다시 부르지 않는다.
export const fillSubwayCoords: ComputeStepRunner = async ({
  db,
  keys,
  deadline,
}): Promise<ComputeResult> => {
  const stops = await loadSubwayStopsWithoutCoords(db);
  if (stops.length === 0)
    return { rowCount: 0, apiCalls: 0, warnings: [], details: { missing: 0 } };
  const kakaoKey = keys.kakaoRest;
  if (!kakaoKey) {
    return {
      rowCount: 0,
      apiCalls: 0,
      warnings: [`KAKAO_REST_API_KEY가 없어 지하철역 ${stops.length}곳 좌표를 채우지 못했습니다`],
      details: { missing: stops.length },
    };
  }

  const budget = new ApiBudget(MAX_CALLS_PER_RUN);
  // 역 목록에만 호선이 있다 (통합 정류장에는 이름만 남는다)
  const stations = await budget.call(() => fetchSeoulSubwayStations(keys.seoulOpenData));
  const lineByCode = new Map(stations.map((s) => [s.stationCode, s.lineName]));
  const found: StopCoords[] = [];
  const notFound: string[] = [];
  try {
    for (const stop of stops) {
      if (Date.now() >= deadline) break;
      const places = await budget.call(() =>
        searchKakaoSubwayPlaces(kakaoKey, subwayStationQuery(stop.name)),
      );
      const place = pickSubwayPlace(places, stop.name, lineByCode.get(stop.stationCode) ?? '');
      if (place) found.push({ stopId: stop.stopId, lat: place.lat, lng: place.lng });
      else notFound.push(`${stop.name}(${stop.stationCode})`);
    }
  } catch (error) {
    if (!(error instanceof QuotaExhaustedError)) throw error;
  }
  await updateStopCoords(db, found);
  const warnings =
    notFound.length > 0
      ? [
          `카카오에서 찾지 못한 역 ${notFound.length}곳: ${notFound.slice(0, MAX_MISSING_SAMPLES).join(', ')}`,
        ]
      : [];
  return {
    rowCount: found.length,
    apiCalls: budget.used,
    warnings,
    details: { missing: stops.length, filled: found.length, notFound: notFound.length },
  };
};
