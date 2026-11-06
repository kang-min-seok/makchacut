import 'server-only';
import { z } from 'zod';

const KakaoEnvSchema = z.object({ KAKAO_REST_API_KEY: z.string().min(1) });

export function getKakaoRestKey(): string {
  return KakaoEnvSchema.parse(process.env).KAKAO_REST_API_KEY;
}
