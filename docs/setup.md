# Setup Guide

## Prerequisites

- **Node.js** 22+ (LTS recommended)
- **pnpm** 9+ (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Discord Bot Token** from the [Discord Developer Portal](https://discord.com/developers/applications)

## 1. Clone and Install

```bash
git clone https://github.com/your-org/imi-tickets.git
cd imi-tickets
pnpm install
```

## 2. Configure Environment

One `.env` at the monorepo root is used by the bot, Vite web app, and Docker Compose.

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `TOKEN` | Discord bot token |
| `FRONTEND_URL` | Web dashboard URL (default `http://localhost:5173` for local Vite and Docker) |
| `HOST` | API listen address (default: `0.0.0.0`) |
| `PORT` | API port (default: `4000`) |
| `DATABASE_FILE` | SQLite path relative to the bot process cwd (`apps/bot` when using pnpm scripts). Docker Compose overrides this with absolute `/app/data/data.db` via `DOCKER_DATABASE_FILE`. |
| `BETTER_AUTH_SECRET` | Random secret for session signing |
| `BETTER_AUTH_URL` | Bot API URL (default: `http://localhost:4000`) |
| `DISCORD_CLIENT_ID` | Discord OAuth application client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth application client secret |
| `VITE_API_URL` | API URL baked into the web build (default: `http://localhost:4000`) |

## 3. Database Migrations

Schema changes are versioned under `apps/bot/drizzle/`. The bot applies pending migrations automatically on startup.

For local CLI use after editing `schema.ts` / `auth.ts`:

```bash
pnpm db:generate   # write a new SQL migration
pnpm db:migrate    # apply pending migrations (also happens on bot start)
```

Optional local prototyping without migration files: `pnpm db:push` (not used by Docker).

## 4. Start Development

```bash
# Terminal 1 - Bot
pnpm dev:bot

# Terminal 2 - Web
pnpm dev:web
```

The web dashboard will be available at `http://localhost:5173`.

## 5. Discord Bot Setup

1. Enable the **Message Content Intent** in your bot's settings
2. Enable **Server Members Intent** and **Presence Intent**
3. Invite the bot with sufficient permissions (Manage Channels, Send Messages, Read Messages, etc.)
4. The bot creates a category for modmail channels on first use

## Production Build

```bash
pnpm build
pnpm --filter @imi/tickets-bot start
```

For production web deployment, serve the `apps/web/dist` folder with nginx or similar.
