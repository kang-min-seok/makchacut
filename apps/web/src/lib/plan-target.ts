import { z } from 'zod';
import { LatLngSchema } from '@makchacut/shared';
import { PLAN_DETAIL_PATH, PLAN_PATH } from '@/lib/routes';

// 결과 화면 주소에 담는 값: 약속 장소와 날짜만 (집은 담지 않는다)
const PlanTargetSchema = z.object({
  name: z.string().min(1),
  lat: z.coerce.number().pipe(LatLngSchema.shape.lat),
  lng: z.coerce.number().pipe(LatLngSchema.shape.lng),
  date: z.iso.date(),
});

export type PlanTarget = z.infer<typeof PlanTargetSchema>;

const WAY_PARAM = 'way';

function toParams(target: PlanTarget): URLSearchParams {
  return new URLSearchParams({
    name: target.name,
    lat: String(target.lat),
    lng: String(target.lng),
    date: target.date,
  });
}

export function planHref(target: PlanTarget): string {
  return `${PLAN_PATH}?${toParams(target).toString()}`;
}

export function planDetailHref(target: PlanTarget, way: number): string {
  const params = toParams(target);
  params.set(WAY_PARAM, String(way));
  return `${PLAN_DETAIL_PATH}?${params.toString()}`;
}

export function parsePlanTarget(params: URLSearchParams): PlanTarget | null {
  const result = PlanTargetSchema.safeParse(Object.fromEntries(params));
  return result.success ? result.data : null;
}

export function parseWayIndex(params: URLSearchParams): number {
  const way = Number(params.get(WAY_PARAM));
  return Number.isInteger(way) && way >= 0 ? way : 0;
}
