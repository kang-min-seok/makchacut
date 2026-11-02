import { loadDataKeys } from '#env';
import { type KricDayCode, fetchKricTimetable, toKricStationCode } from '#kric';
import { formatClock, toServiceMinutes } from '#service-day';
import {
  TAGO_DAY_TYPES,
  TAGO_DIRECTIONS,
  type TagoDayType,
  type TagoScheduleEntry,
  fetchTagoStationSchedule,
  searchTagoSubwayStations,
} from '#tago-subway';

// 역의 요일·방향·행선지별 막차를 TAGO로 출력한다. KRIC_SERVICE_KEY가 있으면 같은 역의 KRIC 열차번호 시간표와 나란히 비교한다.
// 사용: node scripts/subway-last.ts <역이름> [노선명 일부]

const LAST_DEPARTURES_SHOWN = 3;
const KRIC_DAY_BY_TAGO: Record<TagoDayType, KricDayCode> = { '01': '8', '02': '7', '03': '9' };
const DAY_LABEL: Record<TagoDayType, string> = { '01': '평일', '02': '토', '03': '일·공휴일' };

type Departure = { clock: string; minutes: number; label: string };

function sortedDepartures<T>(
  items: T[],
  clockOf: (item: T) => string,
  labelOf: (item: T) => string,
): Departure[] {
  return items
    .map((item) => ({
      clock: clockOf(item),
      minutes: toServiceMinutes(clockOf(item)),
      label: labelOf(item),
    }))
    .filter((d): d is Departure => d.minutes !== undefined)
    .sort((a, b) => a.minutes - b.minutes);
}

function lastByDestination(entries: TagoScheduleEntry[]): Departure[] {
  const departures = sortedDepartures(
    entries,
    (e) => e.departure,
    (e) => e.destinationName || e.destinationId,
  );
  const last = new Map<string, Departure>();
  for (const departure of departures) last.set(departure.label, departure);
  return [...last.values()].sort((a, b) => b.minutes - a.minutes);
}

function toMinuteKey(clock: string): string {
  return formatClock(clock).slice(0, 5);
}

const [stationName, routeFilter] = process.argv.slice(2);
if (!stationName) {
  console.error('사용: node scripts/subway-last.ts <역이름> [노선명 일부]');
  process.exit(1);
}

const keys = loadDataKeys();
const dataKey = keys.DATA_GO_KR_SERVICE_KEY;
if (!dataKey) {
  console.error('DATA_GO_KR_SERVICE_KEY가 없습니다.');
  process.exit(1);
}
const kricKey = keys.KRIC_SERVICE_KEY;

const stations = (await searchTagoSubwayStations(dataKey, stationName)).filter(
  (s) => !routeFilter || s.routeName.includes(routeFilter),
);
if (stations.length === 0) {
  console.error('역을 찾지 못했습니다.');
  process.exit(1);
}

for (const station of stations) {
  console.log(`\n# ${station.stationName} (${station.routeName}, ${station.stationId})`);
  const tagoDepartureKeys = new Map<TagoDayType, Set<string>>();
  let routeId = '';

  console.log('\n## TAGO — 행선지별 막차 출발');
  console.log('| 요일 | 방향 | 행선지 | 막차 출발 | 운행 수 |');
  console.log('|---|---|---|---|---|');
  for (const day of TAGO_DAY_TYPES) {
    const minuteKeys = new Set<string>();
    for (const direction of TAGO_DIRECTIONS) {
      const entries = await fetchTagoStationSchedule(dataKey, station.stationId, day, direction);
      routeId ||= entries[0]?.routeId ?? '';
      const departing = entries.filter((e) => e.departure);
      for (const e of departing) minuteKeys.add(toMinuteKey(e.departure));
      if (departing.length === 0) {
        console.log(
          `| ${DAY_LABEL[day]} | ${direction} | (출발 없음, 전체 ${entries.length}건) | - | 0 |`,
        );
        continue;
      }
      for (const last of lastByDestination(departing)) {
        console.log(
          `| ${DAY_LABEL[day]} | ${direction} | ${last.label} | ${formatClock(last.clock)} | ${departing.length} |`,
        );
      }
    }
    tagoDepartureKeys.set(day, minuteKeys);
  }

  if (!kricKey) {
    console.log('\nKRIC_SERVICE_KEY 없음 — KRIC 비교 건너뜀');
    continue;
  }
  const code = toKricStationCode(station.stationId, routeId);
  if (!code) {
    console.log(`\nKRIC 코드 변환 실패 (routeId ${routeId})`);
    continue;
  }
  console.log(
    `\n## KRIC — railOprIsttCd ${code.railOprIsttCd}, lnCd ${code.lnCd}, stinCd ${code.stinCd}`,
  );
  for (const day of TAGO_DAY_TYPES) {
    try {
      const entries = await fetchKricTimetable(kricKey, code, KRIC_DAY_BY_TAGO[day]);
      const departures = sortedDepartures(
        entries.filter((e) => e.departure),
        (e) => e.departure,
        (e) => `${e.trainNo}${e.expressCode ? ` (급행 ${e.expressCode})` : ''}`,
      );
      const kricKeys = new Set(departures.map((d) => toMinuteKey(d.clock)));
      const tagoKeys = tagoDepartureKeys.get(day) ?? new Set<string>();
      const onlyKric = [...kricKeys].filter((k) => !tagoKeys.has(k));
      const onlyTago = [...tagoKeys].filter((k) => !kricKeys.has(k));
      const lastOnes = departures
        .slice(-LAST_DEPARTURES_SHOWN)
        .map((d) => `${formatClock(d.clock)} ${d.label}`)
        .join(' / ');
      console.log(`- ${DAY_LABEL[day]}: 출발 ${departures.length}건, 마지막 ${lastOnes}`);
      console.log(
        `  TAGO와 분 단위 출발 시각 비교 — KRIC에만 ${onlyKric.length}건, TAGO에만 ${onlyTago.length}건`,
      );
    } catch (error) {
      console.log(`- ${DAY_LABEL[day]}: ${String(error).replaceAll(kricKey, '***')}`);
    }
  }
}
