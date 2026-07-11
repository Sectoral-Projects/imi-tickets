# Project Overview

## About imi/tickets

`imi/tickets` is a Discord modmail system with a staff web UI. Members contact staff through Discord direct messages, the bot creates or reuses a ticket thread, staff work the conversation from Discord and the web UI, and the backend records ticket state, messages, participants, snapshots, notes, tags, attachments, settings, templates, and audit history.

The product currently spans a pnpm monorepo with two apps and a shared package:

| Path | Owns |
| --- | --- |
| `g:/Programming/nw-modmail/apps/bot` | Discord bot, Hono API, Better Auth server, SQLite/Drizzle data model, services, commands, listeners, Discord component templates (`@imi/tickets-bot`) |
| `g:/Programming/nw-modmail/apps/web` | Vite React staff UI, route shells, ticket list/detail screens, Better Auth client, TanStack Query hooks, shadcn UI primitives (`@imi/tickets-web`) |
| `g:/Programming/nw-modmail/packages/shared` | Shared display-title helpers, Zod ticket schemas, message/timeline types, realtime event union (`@imi/tickets-shared`) |

## Problem It Solves

Discord communities need private staff support without exposing member DMs to individual staff accounts or losing conversation history. This project centralizes those conversations into tickets, preserves the Discord identity context at message time, and exposes ticket history through a staff interface.

The backend is the authority for Discord side effects, persistence, auth, and HTTP API behavior. The UI should stay a client of that API.

## Agent Quick Context

- The backend is a single Node process that starts a Sapphire Discord client and a Hono HTTP server together from `src/lib/client.ts`.
- The Hono API listens on port `4000`; the Vite UI runs on port `5173`.
- Better Auth is mounted at `/api/auth/*` and currently uses Discord OAuth.
- First-time hosted deployments should send the first authenticated user through `/onboarding` before normal app usage.
- Product API routes should be protected by the planned custom RBAC system, with server-aware Discord role permissions.
- Domain data and Better Auth data live in SQLite through Drizzle.
- The staff UI uses React Router in `src/main.tsx`, not file-based TanStack Start routes.
- API responses are raw JSON or `{ error: string }`; there is no `{ success, data }` envelope.
- JavaScript commands should use `pnpm` from the monorepo root. Some backend scripts still chain through `npm run` internally; do not add new Bun instructions.
- Shared package tests run via `pnpm test` (`@imi/tickets-shared` / vitest).

## Core User Roles

- Member: a Discord user who opens or continues a ticket by DMing the bot.
- Staff user: a Discord-authenticated user who reviews tickets in Discord or the web UI.
- Bot/system: automated actions that create tickets, record messages, update status, or render Discord Components V2 responses.

Do not describe this project using organization-dashboard, hierarchy, provider, Gateway, Paddle, NATS, or webhook concepts from older unrelated context. Those are not part of the current codebase.

## Current Product Surface

### Discord bot

The bot is built with Sapphire and discord.js. Current command/listener areas include:

- Commands under `apps/bot/src/commands/`: `contact`, `close`, `block`, and `ping`.
- Listeners under `apps/bot/src/listeners/`: message handling, ready, typing, mention-prefix-only responses, and command success/denied logs.
- Discord component templates under `apps/bot/src/lib/components/`, backed by the `message_templates` table and Mustache rendering.

### HTTP API

Implemented route files live under `apps/bot/src/routes/` and are auto-loaded from compiled `dist/routes/`.

```text
GET /heartbeat
GET /tickets
GET /tickets/:ticketId
GET /messages?threadId=&cursor=
GET /messages/:messageId
GET /setup/status
POST /setup/claim
GET|POST /setup/guilds
GET /setup/guilds/:guildId/resources
PATCH /setup/guilds/:guildId/channel-strategy
PUT /setup/guilds/:guildId/roles
POST /setup/complete
GET /protected
GET /settings
GET|POST /api/auth/*
```

Ticket/message product APIs require the custom RBAC layer. Before onboarding is complete they return `ONBOARDING_REQUIRED`, except for the optional `PRIMARY_GUILD_ID` bootstrap path that allows only Discord guild administrators when no custom RBAC rows exist. `/protected` and `/settings` are currently guarded stubs. Treat settings as unfinished unless the code has changed.

### Web UI

The staff UI route tree is declared in `apps/web/src/main.tsx`.

```text
/             Ticket list
/:ticketId    Ticket detail and message history
/onboarding   Planned first-run setup flow
/staff        Staff placeholder
/settings     Settings placeholder
```

The UI currently has ticket list and ticket detail functionality. Staff and settings screens are placeholders/scaffolds.

### First-run onboarding

When a user hosts the app for the first time, preferably through Docker Compose, the website should guide setup before normal ticket management.

Expected flow:

- Ask the user to log in with Discord OAuth.
- After successful login, redirect to `/onboarding` if setup is incomplete.
- Render `/onboarding` as a full-width and full-height page with a centered modal-like step card.
- Link a primary Discord server from the signed-in user's Discord OAuth guild list.
- Link any additional Discord servers that should be watched.
- Run the bot invite flow as needed for each server, then recheck bot presence.
- Ask how ticket channels should be handled, choosing exactly one strategy: Discord category channels or Discord forum-channel posts.
- Ask which Discord roles count as staff for each server.
- Store modular role permissions so roles can grant `READ` only, `READ` plus `MANAGE`, or future permissions.
- After completion, return users to the normal app layout and pages.

## Data Model Summary

The SQLite schema in `apps/bot/src/database/sqlite/schema.ts` includes:

- `threads`: ticket records and lifecycle state.
- `thread_participants`: users/staff attached to a ticket.
- `messages`: Discord message records.
- `member_snapshots`: captured Discord identity data.
- `notes`: staff notes.
- `attachments`: message or note attachments.
- `thread_tags`: ticket tags.
- `thread_status_history`: lifecycle history.
- `audit_log`: durable audit entries.
- `config`: singleton-ish bot/server settings row.
- `message_templates`: DB-overridable Discord component templates.

Better Auth tables live separately in `apps/bot/src/database/sqlite/auth.ts`.

## Development Principles

- Keep Discord side effects in the backend/bot. The UI should call API routes, not Discord APIs.
- Keep Hono route handlers thin. Routes parse request input and delegate business logic to services in `apps/bot/src/services/`.
- Keep service writes auditable when they change ticket state or staff-visible history.
- Use Drizzle query builders and the existing service types instead of raw SQL unless a migration or schema-level operation requires it.
- In the UI, keep route shells thin and place feature logic under `apps/web/src/features/`.
- Use TanStack Query for API state and `apps/web/src/lib/api.ts` as the shared fetch wrapper.
- Keep onboarding setup and later settings edits backed by the same Discord server, channel routing, and RBAC configuration model.
- Use semantic Tailwind/shadcn token classes from `apps/web/src/App.css`; do not introduce hardcoded hex colors or raw palette classes in new UI.

