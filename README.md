# imi/tickets

A Discord modmail bot with a real-time staff web UI. Tickets arrive via DM, get managed through Discord channels, and staff can view full transcripts, timelines, and analytics from the web dashboard.

## Architecture

```
apps/bot    - Discord bot (Sapphire.js, Hono API, better-sqlite3)
apps/web    - Staff dashboard (React, Vite, TanStack Query)
packages/shared - Shared types, schemas, and utilities
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- A Discord bot token

### Development

```bash
# Install dependencies
pnpm install

# One env file for the whole monorepo (bot, web, Docker)
cp .env.example .env
# Edit .env with your credentials

# Run both apps in development
pnpm dev:bot   # Terminal 1
pnpm dev:web   # Terminal 2
```

### Building

```bash
pnpm build        # Build all packages
pnpm build:bot    # Build bot only
pnpm build:web    # Build web only
```

### Docker

```bash
cp .env.example .env
# Edit .env — FRONTEND_URL defaults to http://localhost:5173 for local and Docker
docker compose up --build
```

See [docs/docker.md](docs/docker.md) for Coolify/Dokploy deployment notes.

## Documentation

- [Setup Guide](docs/setup.md)
- [Architecture](docs/architecture.md)
- [Docker Deployment](docs/docker.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
