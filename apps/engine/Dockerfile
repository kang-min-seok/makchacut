# 레포 루트를 빌드 컨텍스트로 사용한다:
#   fly deploy . --config apps/engine/fly.toml --dockerfile apps/engine/Dockerfile
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @makchacut/engine...
RUN pnpm --filter @makchacut/engine build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/engine/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.js"]
