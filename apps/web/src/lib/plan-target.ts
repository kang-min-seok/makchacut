import { z } from 'zod';
import { LatLngSchema } from '@makchacut/shared';
import { PLAN_ANCHORS_PATH, PLAN_DETAIL_PATH, PLAN_PATH } from '@/lib/routes';

// 결과 화면 주소에 담는 값: 약속 장소와 날짜만 (집은 담지 않는다)
const PlanTargetSchema = z.object({
  name: z.string().min(1),
  lat: z.coerce.number().pipe(LatLngSchema.shape.lat),
  lng: z.coerce.number().pipe(LatLngSchema.shape.lng),
  date: z.iso.date(),
});

export type PlanTarget = z.infer<typeof PlanTargetSchema>;

const WAY_PARAM = 'way';
const ANCHOR_PARAM = 'anchor';
const LATER_WAY = 'later';

// 상세 화면이 보여 줄 경로: 연결 방법 n번째 / 더 늦은 경로 / 다른 막차 n번째
export type WayRef =
  { kind: 'way'; index: number } | { kind: 'later' } | { kind: 'anchor'; index: number };

export const FIRST_WAY: WayRef = { kind: 'way', index: 0 };

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

export function planDetailHref(target: PlanTarget, ref: WayRef): string {
  const params = toParams(target);
  if (ref.kind === 'anchor') params.set(ANCHOR_PARAM, String(ref.index));
  else params.set(WAY_PARAM, ref.kind === 'later' ? LATER_WAY : String(ref.index));
  return `${PLAN_DETAIL_PATH}?${params.toString()}`;
}

export function planAnchorsHref(target: PlanTarget): string {
  return `${PLAN_ANCHORS_PATH}?${toParams(target).toString()}`;
}

export function parsePlanTarget(params: URLSearchParams): PlanTarget | null {
  const result = PlanTargetSchema.safeParse(Object.fromEntries(params));
  return result.success ? result.data : null;
}

function indexOf(value: string | null): number | null {
  const index = Number(value);
  return value !== null && Number.isInteger(index) && index >= 0 ? index : null;
}

export function parseWayRef(params: URLSearchParams): WayRef {
  const anchor = indexOf(params.get(ANCHOR_PARAM));
  if (anchor !== null) return { kind: 'anchor', index: anchor };
  const way = params.get(WAY_PARAM);
  if (way === LATER_WAY) return { kind: 'later' };
  return { kind: 'way', index: indexOf(way) ?? 0 };
}
