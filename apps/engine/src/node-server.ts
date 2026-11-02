import { serve } from '@hono/node-server';
import { createApp } from '#create-app';
import { loadConfig } from '#config';

const config = loadConfig();
const app = createApp(config);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`engine listening on :${info.port}`);
});
