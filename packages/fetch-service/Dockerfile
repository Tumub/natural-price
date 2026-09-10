FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/extension/package.json packages/extension/
COPY packages/shared/package.json packages/shared/
COPY packages/fetch-service/package.json packages/fetch-service/
COPY packages/crowd-api/package.json packages/crowd-api/
RUN npm ci --omit=dev --ignore-scripts && npm i -g tsx
COPY packages/extension packages/extension
COPY packages/shared packages/shared
COPY packages/fetch-service packages/fetch-service
COPY docs/payload-schema.json docs/
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -fsS http://localhost:8787/health || exit 1
CMD ["tsx", "packages/fetch-service/src/index.ts"]
