# Bot Source Layout

## Directory Map

| Path | Purpose |
|------|---------|
| `commands/` | Sapphire slash / message commands |
| `listeners/` | Discord gateway event handlers |
| `services/` | Background services (ticket lifecycle, cleanup) |
| `routes/` | Hono HTTP API routes (REST + WebSocket) |
| `lib/` | Shared internal utilities (ticket helpers, auth, Discord helpers) |
| `database/` | Drizzle ORM schema, migrations, SQLite connection |

## Entry Point

`index.ts` boots the Sapphire client which auto-loads commands, listeners, and services from their directories. The Hono HTTP server is started inside `lib/client.ts`.
