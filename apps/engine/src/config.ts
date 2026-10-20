import { z } from 'zod';

const DEFAULT_PORT = 8080;
const MIN_API_KEY_LENGTH = 16;

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  ENGINE_API_KEY: z.string().min(MIN_API_KEY_LENGTH),
});

export type EngineConfig = {
  port: number;
  apiKey: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): EngineConfig {
  const parsed = EnvSchema.parse(env);
  return { port: parsed.PORT, apiKey: parsed.ENGINE_API_KEY };
}
