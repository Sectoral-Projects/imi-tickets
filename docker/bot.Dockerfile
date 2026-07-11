FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/bot/package.json apps/bot/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/bot/ apps/bot/

# Build shared package first, then bot
RUN pnpm --filter @imi/tickets-shared build
RUN pnpm --filter @imi/tickets-bot build

# Production stage
FROM node:22-bookworm-slim AS production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/apps/bot/dist ./apps/bot/dist
COPY --from=base /app/apps/bot/package.json ./apps/bot/
COPY --from=base /app/apps/bot/node_modules ./apps/bot/node_modules
# SQL migrations applied at process startup via drizzle-orm migrator
COPY --from=base /app/apps/bot/drizzle ./apps/bot/drizzle

EXPOSE 4000
WORKDIR /app/apps/bot
CMD ["node", "dist/index.js"]
