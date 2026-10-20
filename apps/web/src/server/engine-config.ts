import 'server-only';
import { z } from 'zod';

const EngineEnvSchema = z.object({
  ENGINE_URL: z.url(),
  ENGINE_API_KEY: z.string().min(1),
});

export type EngineConfig = {
  url: string;
  apiKey: string;
};

export function getEngineConfig(): EngineConfig {
  const env = EngineEnvSchema.parse(process.env);
  return { url: env.ENGINE_URL, apiKey: env.ENGINE_API_KEY };
}
