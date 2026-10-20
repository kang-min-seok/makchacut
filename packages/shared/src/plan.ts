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

export const StepSchema = z.object({
  type: z.enum(STEP_TYPES),
  from: z.string(),
  to: z.string(),
  routeName: z.string().optional(),
  depart: OffsetDateTimeSchema,
  arrive: OffsetDateTimeSchema,
  timeKind: z.enum(TIME_KINDS),
});

export const AnchorSchema = z.object({
  routeName: z.string(),
  stopName: z.string(),
  time: OffsetDateTimeSchema,
  timeKind: z.enum(TIME_KINDS),
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
  anchor: AnchorSchema.nullable(),
  ways: z.array(WaySchema),
  detour: DetourSchema.nullable(),
  notes: z.array(z.string()),
});

export type LatLng = z.infer<typeof LatLngSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type PlanStep = z.infer<typeof StepSchema>;
export type PlanAnchor = z.infer<typeof AnchorSchema>;
export type PlanWay = z.infer<typeof WaySchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
