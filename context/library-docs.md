# Library Docs

Project-specific usage notes for libraries already used by `imi/tickets`. This file is not a replacement for upstream documentation. Before implementing library-specific behavior, fetch current docs for that library, then apply these local rules.

## Before Using Any Library

1. Check whether an installed skill or MCP documentation source exists for the library.
2. Fetch current upstream docs for APIs that change quickly.
3. Apply this file's local conventions over generic examples.
4. Match nearby code before introducing new patterns.

Do not rely on stale guidance from older context packs. This project does not currently use Bun, Elysia, Eden, TanStack Start, Gateway-go, NATS, MongoDB, Postgres, Paddle, or NextStepJS.

## pnpm

- Use `pnpm` from the monorepo root (or filter `@imi/tickets-bot` / `@imi/tickets-web`).
- `apps/bot/.npmrc` says pnpm only and hoists Sapphire packages.
- Do not add npm/yarn/Bun instructions unless the repo configuration changes.
- Backend scripts currently contain `npm run` internally; that is existing script implementation, not preferred documentation style.

## Sapphire Framework

- Sapphire owns Discord commands, listeners, logging, cooldowns, and piece loading.
- `CustomClient` extends `SapphireClient` in `apps/bot/src/lib/client.ts`.
- Commands live in `src/commands`; listeners live in `src/listeners`.
- Use the Sapphire CLI script when scaffolding pieces: `pnpm generate`.
- Keep Discord event code thin. Complex ticket lifecycle behavior belongs in services.
- The client currently enables DM/guild message, DM/guild reaction, guild, member, message content, and typing intents plus user/member/channel/message/reaction partials.

## discord.js

- Use discord.js v14 APIs.
- Preserve Discord snowflake IDs as strings.
- Message attachments, users, roles, channels, and guild members should be normalized before persistence.
- Store durable conversation data in services/SQLite rather than relying on Discord fetches as the only source of history.
- Components rendered by the bot should use Discord Components V2-compatible structures.

## Hono

- Hono is the backend HTTP framework.
- The server starts through `serve({ fetch: app.fetch, port: 4000 })`.
- Global CORS allows `http://localhost:5173` with credentials.
- Route classes extend `Route` and register handlers in `register(app, path)`.
- Keep Hono route handlers as HTTP adapters: parse request data, call services, return JSON.
- Better Auth is mounted through the catch-all route under `/api/auth/*`.

## Route Loader

- Source routes live in `apps/bot/src/routes`.
- Runtime route loading walks `apps/bot/dist/routes`.
- `resolveRoutePath()` converts file paths to URL paths:
  - `tickets.ts` -> `/tickets`
  - `auth/[...catch].ts` -> `/api/*`
  - bracket params -> Hono params
- Build before starting compiled output, otherwise new routes will not exist in `dist`.

## Drizzle And SQLite

- Domain schema: `apps/bot/src/database/sqlite/schema.ts`.
- Auth schema: `apps/bot/src/database/sqlite/auth.ts`.
- Drizzle config: `apps/bot/drizzle.config.ts`.
- Runtime database: `better-sqlite3` through `drizzle-orm/better-sqlite3`.
- Application code should use Drizzle query builders.
- better-sqlite3 transactions are synchronous; never use async callbacks.
- Prefer service methods that accept `DbClient` so operations can compose inside transactions.
- Use audit logging for ticket lifecycle and staff-visible state changes.
- Run `pnpm db:generate` after changing `schema.ts` or `auth.ts` to write SQL under `apps/bot/drizzle/`.
- Runtime applies pending migrations on bot startup via `drizzle-orm/better-sqlite3/migrator` (`applySqliteMigrations` in `apps/bot/src/database/sqlite/migrate.ts`).
- For local one-off CLI apply: `pnpm db:migrate` (`drizzle-kit migrate`). Prefer generate + migrate over `drizzle-kit push` for anything that must match Docker/production.
- Optional prototyping only: `pnpm db:push` (`drizzle-kit push`) updates a local DB without writing migration files. Do not rely on push for Docker — it is not idempotent on SQLite.
- Preview pending push diffs with `pnpm exec drizzle-kit push --verbose` (stop `pnpm dev` first if the database is locked).
- Runtime uses `better-sqlite3` with `journal_mode = DELETE` (single `data.db` file only — no `-wal` / `-shm` sidecars). You can delete any existing `data.db-wal` and `data.db-shm` files after restarting the bot.
- `drizzle.config.ts` and the app both resolve `DATABASE_FILE` through `src/database/sqlite/paths.ts`.
- `@libsql/client` is not used; Drizzle Kit connects through `better-sqlite3` (same as runtime).

## Better Auth

- Better Auth owns browser auth and Discord OAuth.
- Server config lives in `apps/bot/src/lib/auth.ts`.
- Frontend client lives in `apps/web/src/lib/auth-client.ts`.
- Auth base URL defaults to `http://localhost:4000`.
- Trusted UI origin is currently `http://localhost:5173`.
- Discord OAuth uses `identify` and `guilds` scopes (`disableDefaultScope: true`) so setup can list administrator servers via the stored provider access token.
- Browser API requests that require sessions need cookies, so the shared fetch wrapper should include credentials when protected routes are used.
- Better Auth is authentication, not the full product authorization model. Use the custom RBAC layer for server-aware ticket, message, staff, settings, and onboarding permissions.
- Do not invent organization, team, API-key, or platform-admin concepts unless they are added to this project.

## Mustache And Discord Components

- Discord component templates use Mustache for variable interpolation.
- The base component class checks the `message_templates` table for an override by component ID.
- Default templates live in code; DB overrides are operational configuration.
- Keep component IDs stable.
- If a template is JSON, render Mustache recursively through the object tree.
- Avoid arbitrary template execution or untrusted code evaluation; Mustache is for interpolation only.

## Vite And React

- `apps/web` is a Vite SPA, not SSR.
- React 19 is installed.
- React Compiler is configured through `@rolldown/plugin-babel` and `reactCompilerPreset()`.
- Vite alias `@` points to `apps/web/src`.
- Do not add TanStack Start APIs or file-based route assumptions unless the frontend is migrated.

## React Router

- Routes are declared in `apps/web/src/main.tsx` with `BrowserRouter`, `Routes`, and `Route`.
- The layout route renders `src/components/layout.tsx`, which wraps `Navbar`, `Outlet`, and `Footer`.
- Use React Router `Link` for internal navigation when adding or cleaning up UI. Existing navbar code still has some `<a href>` links; avoid copying that pattern for new internal links.

## TanStack Query

- Used for API reads and infinite pagination.
- Ticket list uses `useInfiniteQuery` and flattens pages to `tickets`.
- Message history uses `useInfiniteQuery`, reverses flattened pages to oldest-to-newest display order, and preserves scroll position when older messages are prepended.
- Keep query keys typed and include all request inputs.
- Do not put fetch logic directly in components.

## TanStack Virtual

- Used by `apps/web/src/features/tickets/components/ticket.tsx` to virtualize the ticket timeline inside the shadcn/Base UI `ScrollArea` viewport.
- Use `useVirtualizer` with `getScrollElement: () => viewportRef.current`, measured variable-height rows through `measureElement`, and stable `getItemKey` values based on timeline item identity.
- React 19 projects should pass `useFlushSync: false` unless upstream guidance changes.
- Use `anchorTo: "end"` (chat guide) for prepend/measurement stability. It keeps the visible keyed item stable when older items prepend and compensates above-viewport size deltas, so do NOT hand-roll `scrollTop += heightDiff` restoration. Set `followOnAppend` true only when the view should stick to the newest message (normal mode), false in highlighted-window mode. Pass `scrollEndThreshold` (~80px) so `isAtEnd`/`followOnAppend` tolerate sub-pixel/measurement slack.
- NEVER hand-roll `scrollTop` for a virtualized list. All positioning goes through the virtualizer's own methods (`scrollToEnd`, `scrollToIndex`). Manual `scrollTop = scrollHeight` fights the virtualizer because `scrollHeight` is only the *estimated* `getTotalSize()`; once rows measure real heights the true bottom moves and you end up scrolled up.
- REQUIRED CSS: put `overflow-anchor: none` (and `overscroll-behavior: contain`) on the scroll viewport (via `ScrollArea`'s `viewportClassName`). Without it the browser's native scroll anchoring fights the virtualizer's `anchorTo` adjustments and causes drift during measurement/prepend and inconsistent centering.
- Normal-mode initial bottom: call `virtualizer.scrollToEnd()` in a `useLayoutEffect` and keep re-asserting each frame until `scrollHeight - scrollTop - clientHeight <= 1` holds for a few consecutive frames (generous frame budget), then latch a `didInitialScroll` ref. A fixed re-assert count is NOT enough: with `useFlushSync: false` the virtualizer's internal reconcile can declare the scroll stable against the *estimated* total size one frame before the async re-render lands with measured row heights, leaving the view slightly above the true bottom. `anchorTo: "end"` + `followOnAppend` keep it pinned afterward.
- `scrollToIndex`/`scrollToEnd`/`scrollBy` have a BUILT-IN per-frame reconcile loop (`scrollState` + `reconcileScroll`, ~5s budget) that re-computes the target as rows measure â€” including keeping `behavior: "smooth"` re-targeted. Do not re-issue `scrollToIndex` every frame while a smooth scroll is in flight; that resets the internal state. Also know that targets are CLAMPED to the current (possibly estimated) max scroll offset, so a one-shot call toward far unmeasured content can park short â€” watch the DOM and correct after motion ends.
- Keep ONE contiguous, growing item list with stable keys. `anchorTo: "end"` only stays anchored when keys persist across data changes; wholesale-replacing the list (e.g. a windowed "jump") makes it lose its anchor and fall back to end-anchoring (snaps to the bottom). Grow the list by prepend/append instead.
- Drive infinite loading off the scroll element's real metrics via the viewport `onScroll` handler (`scrollTop` / `scrollHeight` / `clientHeight` with a generous px preload threshold), NOT the virtualizer's virtual index range. The Base UI `ScrollArea.Viewport` is a plain `overflow:scroll` div and its native `onScroll` fires reliably; the virtual index range only trips at the exact edge and re-runs unreliably. Also re-check edges once after each data change (window seed/replace/page) for content already sitting at an edge. Gate on React state flags, never a ref.
- For an unavoidable full-list replacement (a "seek" to a far target), reset `viewport.scrollTop = 0` before committing the new items so `anchorTo: "end"` does not treat it as "was at the end". Cover the swap with a brief overlay rather than a fake scroll-through animation.
- Center on a specific message row in two phases, all through virtualizer APIs: (1) mount the row's block with `scrollToIndex(index, { align: "center" })` (re-issue per frame in auto mode while the element is not yet in the DOM; issue ONCE in smooth mode and let the internal reconcile chase it); (2) once the `[data-message-id]` element exists, correct the remaining offset between the exact row's center and the viewport center with `virtualizer.scrollBy(delta)` until stable for consecutive frames. `scrollToIndex(align:center)` centers the whole virtual row (message group card), NOT the individual message inside it â€” comparing stability against the inner row while only ever issuing `scrollToIndex` can never converge. In smooth mode only apply `scrollBy` corrections after motion has ended (delta stopped changing between frames).

## Zod

- Feature schemas live under `apps/web/src/features/*/schemas`.
- Current schemas are used mostly for inferred TypeScript types.
- If runtime validation is added, parse API responses in feature API modules or the shared fetch layer so components can trust the data shape.
- Remember JSON dates arrive as strings unless explicitly transformed.

## shadcn, Base UI, And Tailwind

- shadcn config lives in `apps/web/components.json`.
- Current shadcn style: `base-nova`.
- Base color: `mist`.
- `rsc` is false.
- UI primitives use `@base-ui/react`.
- Tailwind CSS source is `apps/web/src/App.css`.
- Tailwind v4 tokens are mapped through `@theme inline`.
- Add shadcn primitives with pnpm, for example:

```text
pnpm dlx shadcn@latest add <component>
```

Use semantic token classes from `ui-tokens.md`. Do not hardcode hex values or raw Tailwind palette classes in new UI.

## next-themes

- Theme provider lives in `apps/web/src/components/theme/provider.tsx`.
- Theme toggle lives in `apps/web/src/components/theme/toggle.tsx`.
- Do not create another theme state system.

## lucide-react

- Use `lucide-react` for icons in the staff UI.
- Keep icon sizes consistent with surrounding shadcn primitives, commonly `size-4` or `size-5`.

## Recharts And Resizable Panels

`recharts`, shadcn `chart.tsx`, and `react-resizable-panels` are installed but not central to the current ticket flows. Use them only when building an actual chart or resizable layout, and follow shadcn/Tailwind token rules.

