# 막차컷 (makchacut)

집과 약속 장소를 넣으면, 약속 장소에서 **늦어도 몇 시에 출발해 어느 정류장·역에서 무엇을 타야 집에 가는지** 알려주는 웹 서비스.

## 구조

| 경로                     | 역할                                                        |
| ------------------------ | ----------------------------------------------------------- |
| `apps/web`               | Next.js App Router 웹 (Vercel). `/api/plan`이 엔진을 프록시 |
| `apps/engine`            | Hono 엔진 서버 (Fly.io). 경로 계산, 이후 수집·로거 작업     |
| `packages/shared`        | 웹·엔진 공용 zod 스키마와 상수                              |
| `packages/db`            | Drizzle 스키마·마이그레이션 (Supabase Postgres)             |
| `packages/eslint-config` | 공용 ESLint 규칙                                            |

## 로컬 실행

```bash
pnpm install
cp apps/engine/.env.example apps/engine/.env       # ENGINE_API_KEY 채우기
cp apps/web/.env.example apps/web/.env.local       # 같은 ENGINE_API_KEY
pnpm dev                                           # 웹 :3000, 엔진 :8080
```

## 검사

```bash
pnpm turbo run lint typecheck test build
pnpm format:check
```

## 배포

- **엔진 (Fly.io)**: 레포 루트에서
  ```bash
  fly deploy . --config apps/engine/fly.toml --dockerfile apps/engine/Dockerfile
  fly secrets set ENGINE_API_KEY=... --config apps/engine/fly.toml
  ```
- **웹 (Vercel)**: Root Directory `apps/web`, 환경변수 `ENGINE_URL`, `ENGINE_API_KEY`
- **DB (Supabase)**: `packages/db/.env`에 `DATABASE_URL` 설정 후 `pnpm --filter @makchacut/db db:migrate`
