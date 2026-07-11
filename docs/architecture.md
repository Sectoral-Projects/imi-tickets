# Architecture

## Overview

imi/tickets is a monorepo containing a Discord modmail bot and a staff-facing web dashboard.

```
imi-tickets/
├── apps/
│   ├── bot/          # Discord bot + HTTP API
│   └── web/          # React staff dashboard
├── packages/
│   └── shared/       # Shared types, schemas, utilities
├── docker/           # Dockerfiles and nginx config
└── docs/             # Documentation
```

## Bot (`apps/bot`)

**Runtime:** Node.js (CommonJS)
**Framework:** Sapphire.js (discord.js wrapper with command/listener architecture)
**API:** Hono (HTTP + WebSocket)
**Database:** better-sqlite3 with Drizzle ORM
**Auth:** better-auth (session-based, Discord OAuth)

### Key Directories

| Path | Purpose |
|------|---------|
| `src/commands/` | Slash and message commands |
| `src/listeners/` | Discord gateway event handlers |
| `src/services/` | Background services |
| `src/routes/` | Hono HTTP API routes |
| `src/lib/` | Internal utilities |
| `src/database/` | Drizzle schema and SQLite connection |

### Data Flow

1. User sends DM to the bot
2. Bot creates a ticket (DB row + staff channel)
3. Messages are stored and relayed between DM and staff channel
4. WebSocket broadcasts events to connected web clients
5. Staff can view/manage tickets through the web dashboard

## Web Dashboard (`apps/web`)

**Framework:** React 19 + Vite
**State:** TanStack Query (server state), React state (UI)
**Styling:** Tailwind CSS 4 + shadcn/ui components
**Routing:** React Router 8

### Key Features

- Real-time ticket timeline with virtualized scrolling
- Message highlighting and navigation
- Ticket search and filtering
- Staff settings management
- Discord OAuth authentication

## Shared Package (`packages/shared`)

Contains:
- **Display title utilities** - Ticket title resolution logic
- **Zod schemas** - Ticket, message, participant schemas
- **Type definitions** - Message, timeline, realtime event types
- **Realtime events** - WebSocket event union type

## Communication

- **Bot ↔ Web:** HTTP REST API + WebSocket for real-time events
- **Bot ↔ Discord:** discord.js gateway + REST
- **Auth:** better-auth handles Discord OAuth, sessions stored in SQLite