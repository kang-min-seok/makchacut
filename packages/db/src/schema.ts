import { CONFIDENCE_LEVELS, DAY_TYPES, LAST_TIME_SOURCES } from '@makchacut/core';
import {
  boolean,
  customType,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// 모든 테이블은 RLS를 켜고 정책을 두지 않는다 — Data API로는 접근할 수 없고, 엔진은 테이블 소유자로 pooler에 붙는다.
// 시각 컬럼(*_minutes, *_at_origin 등)은 서비스 일자 기준 분이다(00:40 → 1480, 24:46:30 → 1486.5).

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const ingestStatus = pgEnum('ingest_status', ['running', 'succeeded', 'failed']);
export const dayType = pgEnum('day_type', DAY_TYPES);
export const transitSource = pgEnum('transit_source', ['seoul_bus', 'gbis', 'seoul_subway']);
export const ingestSource = pgEnum('ingest_source', [
  'seoul_bus',
  'gbis',
  'gbis_web',
  'seoul_subway',
  'holiday',
]);
export const stopMode = pgEnum('stop_mode', ['bus', 'subway']);
// 회차 전(기점→회차점) / 회차 후(회차점→종점)
export const routeDirection = pgEnum('route_direction', ['outbound', 'inbound']);
// 상행·내선 / 하행·외선
export const trainDirection = pgEnum('train_direction', ['up', 'down']);
export const lastTimeSource = pgEnum('last_time_source', LAST_TIME_SOURCES);
export const confidence = pgEnum('confidence', CONFIDENCE_LEVELS);

export const ingestRun = pgTable('ingest_run', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  status: ingestStatus('status').notNull().default('running'),
  rowCount: integer('row_count'),
  // 이 실행에서 쓴 외부 API 호출 수(재시도 포함). 출처별 하루 한도를 여기서 센다.
  apiCalls: integer('api_calls').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}).enableRLS();

// 수집 대상(노선·역 등)별 진행 상태. 오래전에 성공한 대상부터 한도 안에서 골라 갱신한다.
export const ingestTarget = pgTable(
  'ingest_target',
  {
    id: serial('id').primaryKey(),
    source: ingestSource('source').notNull(),
    targetId: text('target_id').notNull(),
    // 요일별로 따로 수집해야 하는 출처만 채운다
    dayType: dayType('day_type'),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastError: text('last_error'),
    failCount: integer('fail_count').notNull().default(0),
    // 목록 API에서 사라진 대상
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => [
    unique('ingest_target_source_target_day_unique')
      .on(t.source, t.targetId, t.dayType)
      .nullsNotDistinct(),
    index('ingest_target_source_success_idx').on(t.source, t.lastSuccessAt),
  ],
).enableRLS();

export const holiday = pgTable('holiday', {
  date: date('date', { mode: 'string' }).primaryKey(),
  name: text('name').notNull(),
}).enableRLS();

// 통합 정류장·역. 서울·경기에 따로 있는 같은 정류장은 하나로 묶고, 원본은 stop_source에 남긴다.
export const stop = pgTable('stop', {
  id: serial('id').primaryKey(),
  mode: stopMode('mode').notNull(),
  name: text('name').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  // 정류장 번호(ARS). 역은 비운다.
  stopNo: text('stop_no'),
}).enableRLS();

export const stopSource = pgTable(
  'stop_source',
  {
    source: transitSource('source').notNull(),
    sourceStopId: text('source_stop_id').notNull(),
    stopId: integer('stop_id')
      .notNull()
      .references(() => stop.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    stopNo: text('stop_no'),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.sourceStopId] }),
    index('stop_source_stop_idx').on(t.stopId),
  ],
).enableRLS();

// 버스 노선과 지하철 노선(호선)
export const route = pgTable(
  'route',
  {
    id: serial('id').primaryKey(),
    source: transitSource('source').notNull(),
    sourceRouteId: text('source_route_id').notNull(),
    name: text('name').notNull(),
    // 원본 유형명(간선·광역·직행좌석·지하철 등)
    routeType: text('route_type'),
    originStopId: integer('origin_stop_id').references(() => stop.id, { onDelete: 'set null' }),
    turnStopId: integer('turn_stop_id').references(() => stop.id, { onDelete: 'set null' }),
  },
  (t) => [unique('route_source_route_unique').on(t.source, t.sourceRouteId)],
).enableRLS();

// 같은 정류장이 회차 전·후로 두 번 나오면 순번만 달리해 둘 다 저장한다
export const routeStop = pgTable(
  'route_stop',
  {
    routeId: integer('route_id')
      .notNull()
      .references(() => route.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    stopId: integer('stop_id')
      .notNull()
      .references(() => stop.id, { onDelete: 'cascade' }),
    direction: routeDirection('direction').notNull(),
    distanceFromOriginM: integer('distance_from_origin_m'),
    // 직전 정류장 → 이 정류장 구간 (GBIS 웹 ptts·length). 정류장 목록을 다시 받아도 유지한다.
    segmentSeconds: integer('segment_seconds'),
    segmentMeters: integer('segment_meters'),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.seq] }), index('route_stop_stop_idx').on(t.stopId)],
).enableRLS();

export const busSchedule = pgTable(
  'bus_schedule',
  {
    routeId: integer('route_id')
      .notNull()
      .references(() => route.id, { onDelete: 'cascade' }),
    dayType: dayType('day_type').notNull(),
    firstAtOrigin: real('first_at_origin'),
    lastAtOrigin: real('last_at_origin'),
    firstAtTurn: real('first_at_turn'),
    lastAtTurn: real('last_at_turn'),
    minHeadwayMinutes: smallint('min_headway_minutes'),
    maxHeadwayMinutes: smallint('max_headway_minutes'),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.dayType] })],
).enableRLS();

export const busStopLast = pgTable(
  'bus_stop_last',
  {
    routeId: integer('route_id').notNull(),
    seq: integer('seq').notNull(),
    dayType: dayType('day_type').notNull(),
    lastMinutes: real('last_minutes').notNull(),
    source: lastTimeSource('source').notNull(),
    confidence: confidence('confidence').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.routeId, t.seq, t.dayType] }),
    foreignKey({
      name: 'bus_stop_last_route_stop_fk',
      columns: [t.routeId, t.seq],
      foreignColumns: [routeStop.routeId, routeStop.seq],
    }).onDelete('cascade'),
  ],
).enableRLS();

// 서울 버스 API 정류장별 막차(lastTm) 원본. 조회일의 요일 유형으로 저장하고, bus_stop_last 계산의 입력으로 쓴다.
export const seoulStopLast = pgTable(
  'seoul_stop_last',
  {
    routeId: integer('route_id').notNull(),
    seq: integer('seq').notNull(),
    dayType: dayType('day_type').notNull(),
    lastMinutes: real('last_minutes').notNull(),
    observedOn: date('observed_on', { mode: 'string' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.routeId, t.seq, t.dayType] }),
    foreignKey({
      name: 'seoul_stop_last_route_stop_fk',
      columns: [t.routeId, t.seq],
      foreignColumns: [routeStop.routeId, routeStop.seq],
    }).onDelete('cascade'),
  ],
).enableRLS();

export const trainTrip = pgTable(
  'train_trip',
  {
    id: serial('id').primaryKey(),
    routeId: integer('route_id')
      .notNull()
      .references(() => route.id, { onDelete: 'cascade' }),
    trainNo: text('train_no').notNull(),
    dayType: dayType('day_type').notNull(),
    direction: trainDirection('direction').notNull(),
    destinationStopId: integer('destination_stop_id').references(() => stop.id, {
      onDelete: 'set null',
    }),
    destinationName: text('destination_name'),
    isExpress: boolean('is_express').notNull().default(false),
  },
  (t) => [unique('train_trip_route_day_train_unique').on(t.routeId, t.dayType, t.trainNo)],
).enableRLS();

// 순환선은 한 열차가 같은 역을 두 번 지날 수 있어 (trip, stop)을 키로 쓰지 않는다
export const trainStopTime = pgTable(
  'train_stop_time',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trainTrip.id, { onDelete: 'cascade' }),
    stopId: integer('stop_id')
      .notNull()
      .references(() => stop.id, { onDelete: 'cascade' }),
    arrivalMinutes: real('arrival_minutes'),
    departureMinutes: real('departure_minutes'),
  },
  (t) => [
    index('train_stop_time_trip_idx').on(t.tripId),
    index('train_stop_time_stop_idx').on(t.stopId),
  ],
).enableRLS();

export const footpath = pgTable(
  'footpath',
  {
    fromStopId: integer('from_stop_id')
      .notNull()
      .references(() => stop.id, { onDelete: 'cascade' }),
    toStopId: integer('to_stop_id')
      .notNull()
      .references(() => stop.id, { onDelete: 'cascade' }),
    walkSeconds: integer('walk_seconds').notNull(),
  },
  (t) => [primaryKey({ columns: [t.fromStopId, t.toStopId] })],
).enableRLS();

// 요일 유형별 탐색 그래프 스냅샷 (gzip "MKG1" 바이너리). 계산 단계가 만들고 엔진 /plan이 읽어 메모리에 둔다.
export const graphSnapshot = pgTable('graph_snapshot', {
  dayType: dayType('day_type').primaryKey(),
  data: bytea('data').notNull(),
  byteSize: integer('byte_size').notNull(),
  stopCount: integer('stop_count').notNull(),
  patternCount: integer('pattern_count').notNull(),
  tripCount: integer('trip_count').notNull(),
  builtAt: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
