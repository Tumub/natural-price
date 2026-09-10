FROM node:22-slim
# curl is what platform health checks (Coolify, Docker HEALTHCHECK) call inside the container.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/extension/package.json packages/extension/
COPY packages/shared/package.json packages/shared/
COPY packages/crowd-api/package.json packages/crowd-api/
COPY packages/fetch-service/package.json packages/fetch-service/
RUN npm ci --omit=dev --ignore-scripts && npm i -g tsx
COPY packages/extension packages/extension
COPY packages/shared packages/shared
COPY packages/crowd-api packages/crowd-api
COPY docs/payload-schema.json docs/crowd-aggregation.sql docs/
ENV PORT=8788 NP_CROWD_DB=/data/crowd.sqlite
VOLUME /data
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -fsS http://localhost:8788/health || exit 1
CMD ["tsx", "packages/crowd-api/src/index.ts"]
