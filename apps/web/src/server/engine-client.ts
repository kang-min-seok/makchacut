import 'server-only';
import { z } from 'zod';
import {
  ENGINE_API_KEY_HEADER,
  ENGINE_PLAN_PATH,
  PlanResponseSchema,
  type PlanRequest,
  type PlanResponse,
} from '@makchacut/shared';
import { getEngineConfig } from '@/server/engine-config';

const ENGINE_TIMEOUT_MS = 10_000;

export type EnginePlanResult =
  { ok: true; plan: PlanResponse } | { ok: false; status: number; error: string };

const ErrorBodySchema = z.object({ error: z.string() });
const UNKNOWN_ERROR = 'unknown';

// 엔진이 준 오류 상태(422·503 등)는 그대로 돌려주고, 연결 실패·형식 오류는 던진다
export async function requestPlan(request: PlanRequest): Promise<EnginePlanResult> {
  const { url, apiKey } = getEngineConfig();
  const res = await fetch(new URL(ENGINE_PLAN_PATH, url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', [ENGINE_API_KEY_HEADER]: apiKey },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = ErrorBodySchema.safeParse(await res.json().catch(() => null));
    return { ok: false, status: res.status, error: body.success ? body.data.error : UNKNOWN_ERROR };
  }
  return { ok: true, plan: PlanResponseSchema.parse(await res.json()) };
}
