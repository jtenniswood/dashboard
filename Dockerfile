FROM node:24-bookworm-slim AS build
WORKDIR /build
RUN npm install --global pnpm@9.0.6
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN VUE_CLI_MODE_STANDALONE=1 pnpm exec vue-cli-service build --mode standalone --dest dist

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
WORKDIR /app
COPY --from=build /build/dist ./dist
COPY standalone/server.mjs standalone/metrics.mjs ./standalone/
COPY LICENSE NOTICE ./
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8080
CMD ["node", "standalone/server.mjs"]
