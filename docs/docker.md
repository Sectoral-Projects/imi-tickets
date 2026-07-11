# Docker Deployment

## Quick Start

```bash
docker compose up --build -d
```

This starts:
- **bot** - Discord bot + API server on port 4000
- **web** - Nginx serving the built dashboard on port 5173

On bot startup the process applies pending SQL migrations from `apps/bot/drizzle` via `drizzle-orm/better-sqlite3/migrator` (idempotent). No shell entrypoint is required.

## Environment Variables

Copy `.env.example` to `.env` in the project root and fill in your secrets. The same file is used for local development and Docker. Compose reads `.env` for substitution and passes it to the bot via `env_file`.

| Variable | Default (Compose) | Notes |
|----------|-------------------|--------|
| `HOST` | `0.0.0.0` | API bind address |
| `PORT` | `4000` | API port (host + container) |
| `FRONTEND_URL` | `http://localhost:5173` | OAuth / CORS origin for the web UI |
| `BETTER_AUTH_URL` | `http://localhost:4000` | Better Auth base URL |
| `VITE_API_URL` | `http://localhost:4000` | Baked into the web image at build time |
| `WEB_PORT` | `5173` | Host port for the dashboard |
| `WEB_CONTAINER_PORT` | `80` | Container port published for the web service (must match nginx `listen` in `docker/nginx.conf`) |
| `DOCKER_DATABASE_FILE` | `/app/data/data.db` | Absolute SQLite path **inside** the bot container (Compose sets `DATABASE_FILE` to this) |
| `DATA_DIR` | `./data` | Host folder mounted at `/app/data` |

### `DATABASE_FILE` pathing

- **Local:** relative paths are resolved from the process cwd. Bot scripts run with cwd `apps/bot`, so the default `src/database/sqlite/data.db` means `apps/bot/src/database/sqlite/data.db` — not the monorepo root.
- **Docker:** Compose ignores the local relative `DATABASE_FILE` and sets an absolute path (`DOCKER_DATABASE_FILE`, default `/app/data/data.db`) so the file lives on the `DATA_DIR` volume.

Secrets (`TOKEN`, `BETTER_AUTH_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`) come from `.env` via `env_file` and do not need Compose defaults.

For the Compose web UI, set `FRONTEND_URL=http://localhost:5173` (or your public URL) so OAuth redirects match the dashboard.
## Volumes

| Volume | Purpose |
|--------|---------|
| `./data` | SQLite database persistence |

## Building Individual Images

```bash
# Bot
docker build -f docker/bot.Dockerfile -t imi-tickets-bot .

# Web
docker build -f docker/web.Dockerfile -t imi-tickets-web .
```

## Coolify Deployment

1. Create a new project, add a Docker Compose resource
2. Point it to your repository
3. Set environment variables in the Coolify UI
4. The compose file is ready to use as-is
5. Set the custom domain for the web service in Coolify's proxy settings

## Dokploy Deployment

1. Create a new Compose deployment
2. Use the repository URL and branch
3. Configure environment variables in Dokploy's UI
4. Dokploy will auto-detect the `docker-compose.yml`
5. Configure domains through Dokploy's Traefik integration

## Custom Domain / Reverse Proxy

When running behind a reverse proxy (Traefik, Caddy, nginx):

1. Set `FRONTEND_URL` to your public web dashboard URL
2. Set `VITE_API_URL` to your public bot API URL
3. Ensure WebSocket upgrade headers are forwarded for `/ws` endpoint

Example Caddy config:

```
tickets.example.com {
    reverse_proxy web:80
}

api.tickets.example.com {
    reverse_proxy bot:4000
}
```

## Health Checks

- Bot: `GET http://bot:4000/` (returns 200 when ready)
- Web: `GET http://web:80/` (nginx serves index.html)