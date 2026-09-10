FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/extension/package.json packages/extension/
COPY packages/fetch-service/package.json packages/fetch-service/
RUN npm ci --omit=dev --ignore-scripts && npm i -g tsx
COPY packages/extension packages/extension
COPY packages/fetch-service packages/fetch-service
ENV PORT=8787
EXPOSE 8787
CMD ["tsx", "packages/fetch-service/src/index.ts"]
