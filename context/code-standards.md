# Code Standards

Implementation rules and conventions for `imi/tickets`. Follow these in every session unless the user explicitly changes direction.

## Engineering Mindset

- Read the context pack and relevant code before editing.
- Keep scope tight. Do not refactor unrelated code while implementing a feature.
- Prefer existing patterns over new abstractions.
- Keep route handlers thin and service methods readable.
- Make behavior verifiable. If no test runner exists for the touched area, document the manual verification path.
- Do not hide failures. Catch expected operational failures where the surrounding code can recover or report a clear error.

## Shell / Terminal

The developer environment uses Windows PowerShell. Terminal commands must use PowerShell syntax and paths.

- Use PowerShell path style when needed: `g:\Programming\nw-modmail\apps\bot`.
- Set env vars with `$env:NAME = "value"`; do not use `export`.
- Read env vars with `$env:NAME`; do not use `$NAME`.
- Chain commands with `;` or PowerShell-compatible `&&` / `||`.
- Use PowerShell here-strings for multi-line command arguments when needed.
- Do not assume bash-only tools or flags.

## Package Manager And Commands

The monorepo root has `pnpm-workspace.yaml` and `pnpm-lock.yaml`; use pnpm only.

Use `pnpm` for new instructions:

```text
cd g:\Programming\nw-modmail\apps\bot
pnpm install
pnpm dev
pnpm watch:start
pnpm format

cd g:\Programming\nw-modmail\apps\web
pnpm install
pnpm dev
pnpm build
pnpm lint
```

The backend scripts currently call `npm run` internally for `dev` and `watch:start`. That is existing script content, not a reason to add new npm-only guidance.

Do not add Bun, yarn, or pnpm-to-npm migration instructions unless the repo configuration changes.

## TypeScript

- Keep strict TypeScript intent. Prefer explicit types at public boundaries.
- Do not use `any` in new code. Use `unknown` and narrow, or add a local type.
- Avoid type assertions. If one is unavoidable because of a third-party library boundary, keep it small and explain why nearby.
- Use `const` by default; use `let` only for reassignment.
- Do not leave floating promises.
- Prefer named exports for reusable functions, services, hooks, and feature components.
- Existing route shell files in `apps/web` may use default exports because React Router setup currently imports them that way. Do not create churn just to normalize exports.

## Imports And Aliases

Both repos use `@/*` as an alias to `src/*`.

- Backend alias: configured in `apps/bot/tsconfig.json`; compiled aliases are resolved by `tsc-alias`.
- Frontend alias: configured in `apps/web/vite.config.ts` and `tsconfig.app.json`.
- Prefer `@/` imports for cross-folder project imports.
- Keep relative imports for nearby files inside the same feature or folder when that is already the local pattern.

## Backend Standards

### Sapphire Pieces

- Commands live in `apps/bot/src/commands/`.
- Listeners live in `apps/bot/src/listeners/`.
- Use Sapphire conventions for command/listener classes and generated pieces.
- Keep Discord event handling focused on Discord-specific input/output; delegate persistence and ticket lifecycle rules to services.

### Hono Routes

- Routes live in `apps/bot/src/routes/`.
- Each route file default-exports a class extending `Route` from `src/lib/api/route.ts`.
- Implement `register(app, path)` and bind handlers there.
- Route handlers should parse params/query/body, return JSON responses, and call services for real work.
- Keep response shapes consistent with existing routes: plain JSON success values, `{ error: string }` for simple route errors.
- Remember the loader reads `dist/routes`, so route changes require a build before `node dist/index.js` sees them.
- Product routes must use the shared custom RBAC layer. Prefer `@Protected()` on route handler methods, with optional lowercase permissions such as `@Protected(['read', 'manage'])`; do not add one-off role checks inside individual handlers.

### Services

Services live in `apps/bot/src/services/` and currently use abstract classes with static methods.

- Accept `db: DbClient = container.sqlite` for service methods that can operate inside or outside a transaction.
- Use `container.sqlite.transaction((tx) => { ... })` for multi-write operations.
- Do not use `async` or `await` inside better-sqlite3 transaction callbacks.
- Use `.run()`, `.get()`, and `.all()` to finish Drizzle statements inside transactions.
- Write audit records for staff-visible or lifecycle-changing actions.
- Keep pagination contracts stable: numeric offset cursor in, `nextCursor` out.
- Prefer service reuse from commands/routes instead of duplicating Drizzle queries.

### RBAC

The custom RBAC model should be server-aware and modular.

- Better Auth proves the browser user identity; RBAC decides what product data/actions that user can access.
- Staff permissions come from configured Discord roles per linked Discord server.
- Permission flags should be stable strings or constants: `READ`, `MANAGE`, and `ADMIN`.
- A role can grant `READ` only, `READ` plus `MANAGE`, or full `ADMIN` (which includes manage/read).
- Product APIs should check permissions before returning data or mutating state.
- `/settings` and template/settings mutations require `ADMIN`. Ticket transcript APIs require `READ`.
- Keep RBAC logic in shared services/helpers so ticket routes, message routes, settings routes, onboarding routes, and staff routes make consistent decisions.
- Frontend checks are affordances only; never depend on them for security.

### Database

- Domain schema lives in `apps/bot/src/database/sqlite/schema.ts`.
- Better Auth schema lives in `apps/bot/src/database/sqlite/auth.ts`.
- Database helpers: `apps/bot/src/database/sqlite/paths.ts`, `apps/bot/src/database/sqlite/db.ts`, `apps/bot/src/database/sqlite/migrate.ts`.
- Versioned SQL migrations live under `apps/bot/drizzle/`. After schema edits run `pnpm db:generate`, then rely on bot startup (or `pnpm db:migrate`) to apply them. Use `pnpm db:push` only for local prototyping.
- Use Drizzle query builders for application code.
- Treat date fields carefully: SQLite timestamp columns may arrive as `Date` instances in backend code but serialized JSON becomes strings in the browser.

### Environment

Current backend env vars include:

```text
TOKEN
DATABASE_FILE
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
NODE_ENV
PRIMARY_GUILD_ID
```

`PRIMARY_GUILD_ID` is optional. When set before onboarding is complete and no custom RBAC rows exist, product API access can be bootstrapped for Discord users with `ADMINISTRATOR` in that guild.

Do not commit secrets. Check `.gitignore` before adding any env file guidance; if `.env` is tracked or unignored, warn the user before touching it.

## Frontend Standards

### Routing

The frontend uses React Router in `apps/web/src/main.tsx`.

- Keep route shell files (`App.tsx`, `Ticket.tsx`, `Staff.tsx`, `Settings.tsx`) thin.
- Add `/onboarding` outside the normal navbar/footer layout when implementing first-run setup.
- Put feature behavior under `apps/web/src/features/<feature>/`.
- Do not create a TanStack Start `src/routes/` tree unless the app is intentionally migrated.

### Feature Structure

Use this shape for frontend features:

```text
src/features/<feature>/
  api/
  hooks/
  schemas/
  components/
  utils/        optional
```

- API modules call `src/lib/api.ts`.
- Hooks wrap TanStack Query.
- Schemas live near feature types. If runtime validation is added, parse API responses at the boundary rather than deep in components.
- Components should compose shadcn primitives and feature hooks.

### TanStack Query

- Use `useQuery` for single resources and `useInfiniteQuery` for paginated tickets/messages.
- Query keys should include all inputs that affect the request.
- Preserve current pagination behavior unless the API changes.
- Keep scroll preservation logic close to the message list component that owns the scroll container.

### Fetch And Auth

- `apps/web/src/lib/api.ts` owns shared API fetch behavior.
- `VITE_API_URL` defaults to `http://localhost:4000`.
- Better Auth client lives in `apps/web/src/lib/auth-client.ts`.
- API calls requiring Better Auth cookies should use `credentials: "include"` in the shared fetch layer.
- Product API calls should be written assuming backend RBAC can return unauthorized or forbidden responses.
- Do not create one-off fetch wrappers inside components.

## UI Standards

- Use shadcn primitives from `apps/web/src/components/ui/` first.
- Use `cn()` from `apps/web/src/lib/utils` for conditional classes.
- Use semantic token classes from `apps/web/src/App.css`: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, and related variables.
- Do not add hardcoded hex colors or raw Tailwind palette classes in new UI.
- Existing raw palette usage should be recorded as a known exception in `ui-registry.md`; do not copy it into new components.
- Prefer `lucide-react` for icons.
- Use `next-themes` through the existing theme provider/toggle.

## Verification

- Backend docs or code changes: at minimum run the relevant build/start command if behavior changed.
- Frontend code changes: run `pnpm lint` and `pnpm build` when practical.
- Docs-only changes: reread the touched docs and search for stale product names/paths.
- No test runner is currently configured; do not claim automated tests passed unless one has been added and run.

