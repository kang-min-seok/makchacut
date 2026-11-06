import { z } from 'zod';
import { PlanOptionsSchema } from '#plan-options';

const LATITUDE_LIMIT = 90;
const LONGITUDE_LIMIT = 180;

export const LatLngSchema = z.object({
  lat: z.number().min(-LATITUDE_LIMIT).max(LATITUDE_LIMIT),
  lng: z.number().min(-LONGITUDE_LIMIT).max(LONGITUDE_LIMIT),
});

export const PlanRequestSchema = z.object({
  home: LatLngSchema,
  meetup: LatLngSchema,
  date: z.iso.date(),
  options: PlanOptionsSchema.partial().optional(),
});

const OffsetDateTimeSchema = z.iso.datetime({ offset: true });

export const TIME_KINDS = ['scheduled', 'estimated', 'realtime'] as const;
export const STEP_TYPES = ['walk', 'bus', 'subway'] as const;
// 핵심 연결 막차 시각의 출처. 버스는 DB bus_stop_last.source와 같은 값, 지하철은 timetable.
export const ANCHOR_SOURCES = ['seoul_api', 'gbis_eta', 'distance', 'timetable'] as const;
export const ANCHOR_CONFIDENCES = ['low', 'medium', 'high'] as const;
// 계산에 쓴 시간표의 요일 유형. core DAY_TYPES와 같은 값.
export const PLAN_DAY_TYPES = ['weekday', 'sat', 'sun', 'holiday'] as const;

export const StepSchema = z.object({
  type: z.enum(STEP_TYPES),
  from: z.string(),
  to: z.string(),
  routeName: z.string().optional(),
  depart: OffsetDateTimeSchema,
  arrive: OffsetDateTimeSchema,
  timeKind: z.enum(TIME_KINDS),
  // 지도 표시용 좌표. 걷기는 [출발, 도착], 탑승은 지나는 정류장 순서. 좌표 없는 정류장은 빠진다.
  path: z.array(LatLngSchema),
  // 이 탑승이 핵심 연결(anchor)이다
  isAnchor: z.boolean(),
});

export const AnchorSchema = z.object({
  routeName: z.string(),
  stopName: z.string(),
  time: OffsetDateTimeSchema,
  timeKind: z.enum(TIME_KINDS),
  source: z.enum(ANCHOR_SOURCES),
  confidence: z.enum(ANCHOR_CONFIDENCES),
});

export const WaySchema = z.object({
  latestDeparture: OffsetDateTimeSchema,
  steps: z.array(StepSchema),
});

export const DetourSchema = z.object({
  deadline: OffsetDateTimeSchema,
  extraMinutes: z.number().int().nonnegative(),
});

export const PlanResponseSchema = z.object({
  deadline: OffsetDateTimeSchema,
  dayType: z.enum(PLAN_DAY_TYPES),
  anchor: AnchorSchema.nullable(),
  ways: z.array(WaySchema),
  detour: DetourSchema.nullable(),
  notes: z.array(z.string()),
});

export type LatLng = z.infer<typeof LatLngSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type PlanStep = z.infer<typeof StepSchema>;
export type PlanAnchor = z.infer<typeof AnchorSchema>;
export type AnchorSource = (typeof ANCHOR_SOURCES)[number];
export type AnchorConfidence = (typeof ANCHOR_CONFIDENCES)[number];
export type PlanDayType = (typeof PLAN_DAY_TYPES)[number];
export type PlanWay = z.infer<typeof WaySchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
