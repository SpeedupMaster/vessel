# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/package.json ./web/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production Runtime Stage
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache docker-cli docker-cli-compose curl bash caddy

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY web/package.json ./web/

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate && \
    pnpm install --prod --frozen-lockfile

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/web/dist ./web/dist

ENV PORT=3900
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV XDG_DATA_HOME=/app/data/caddy
ENV XDG_CONFIG_HOME=/app/data/caddy-config
ENV DOCKER_CONFIG=/app/data/docker

EXPOSE 3900 80 443

CMD ["node", "server/dist/index.js"]
