import 'server-only';
import {
  ENGINE_API_KEY_HEADER,
  ENGINE_PLAN_PATH,
  PlanResponseSchema,
  type PlanRequest,
  type PlanResponse,
} from '@makchacut/shared';
import { getEngineConfig } from '@/server/engine-config';

const ENGINE_TIMEOUT_MS = 10_000;

export async function requestPlan(request: PlanRequest): Promise<PlanResponse> {
  const { url, apiKey } = getEngineConfig();
  const res = await fetch(new URL(ENGINE_PLAN_PATH, url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', [ENGINE_API_KEY_HEADER]: apiKey },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`engine responded ${res.status}`);
  }
  return PlanResponseSchema.parse(await res.json());
}
