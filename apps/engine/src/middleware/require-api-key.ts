import { createMiddleware } from 'hono/factory';
import { ENGINE_API_KEY_HEADER } from '@makchacut/shared';

export function requireApiKey(apiKey: string) {
  return createMiddleware(async (c, next) => {
    if (c.req.header(ENGINE_API_KEY_HEADER) !== apiKey) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    await next();
  });
}
