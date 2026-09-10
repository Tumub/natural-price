FROM node:22-slim
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
CMD ["tsx", "packages/crowd-api/src/index.ts"]
