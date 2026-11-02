# 운영 배포는 Vercel(apps/engine/vercel.json, 서울 icn1)이다. 이 이미지는 상시 서버로 옮겨야 할 때의 대비용이다.
# 레포 루트를 빌드 컨텍스트로 사용한다:
#   docker build -f apps/engine/Dockerfile .
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
CMD ["node", "dist/node-server.js"]
