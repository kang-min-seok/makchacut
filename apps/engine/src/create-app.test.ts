import { describe, expect, it } from 'vitest';
import { ENGINE_API_KEY_HEADER, ENGINE_PLAN_PATH, PlanResponseSchema } from '@makchacut/shared';
import { createApp } from '#create-app';

const API_KEY = 'test-key-0123456789';
const app = createApp({ apiKey: API_KEY });

const validRequest = {
  home: { lat: 37.2006, lng: 127.0957 },
  meetup: { lat: 37.4321, lng: 127.1295 },
  date: '2026-10-23',
};

function postPlan(body: unknown, key = API_KEY) {
  return app.request(ENGINE_PLAN_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [ENGINE_API_KEY_HEADER]: key },
    body: JSON.stringify(body),
  });
}

describe('engine app', () => {
  it('reports health without a key', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('rejects /plan without the right key', async () => {
    const res = await postPlan(validRequest, 'wrong-key');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid plan request', async () => {
    const res = await postPlan({ ...validRequest, date: 'tomorrow' });
    expect(res.status).toBe(400);
  });

  it('returns a response matching the shared schema', async () => {
    const res = await postPlan(validRequest);
    expect(res.status).toBe(200);
    expect(PlanResponseSchema.safeParse(await res.json()).success).toBe(true);
  });
});
