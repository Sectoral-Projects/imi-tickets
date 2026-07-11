# Build Plan

Durable roadmap guidance for `imi/tickets`. Use this file for phase ordering and cross-cutting constraints, not as a detailed task checklist.

No authoritative issue tracker was found in the repos when this file was rewritten. If the user points to Linear, GitHub Issues, or another tracker, treat that tracker as the live source of item-level scope and status.

## Principles

- The backend owns Discord side effects, auth server behavior, persistence, and ticket business rules.
- The frontend owns browser routing, layout, UI components, TanStack Query state, and API client behavior.
- First-time self-hosting should provide a guided onboarding experience after Discord OAuth login, ideally for Docker Compose deployments.
- All product API routes must be protected by the custom RBAC system once it exists; do not leave ticket, message, settings, staff, or onboarding data behind session-only or unprotected route checks.
- Build one feature at a time and keep changes within the feature's ownership boundary.
- Keep Hono routes thin and move reusable behavior into services.
- Keep Discord command/listener behavior consistent with service behavior.
- Prefer protected API routes plus UI calls over frontend-only staff behavior.
- Do not duplicate stale roadmap details in this file once a real tracker exists.

## Phase 1: Documentation And Context

Keep the context pack aligned with the real two-repo system.

Goals:

- Keep `project-overview.md` and `architecture.md` current when the system shape changes.
- Keep `ui-registry.md` updated after new or changed UI component patterns.
- Record known drift and placeholders so agents do not treat accidental code as ideal convention.
- Remove references to unrelated systems when they appear.

## Phase 2: Backend Foundation

Stabilize the bot/API core before expanding staff workflows.

Likely work:

- Confirm `pnpm` workflow and clean up scripts if requested.
- Document or add Drizzle migration commands.
- Ensure route loading from `dist/routes` is well understood in dev workflows.
- Review `.env` handling and secret safety.
- Align direct command DB usage with service methods where practical.
- Finish or remove stubs only when product scope is clear.

## Phase 3: Auth And Staff Access

Make staff-facing API and UI access explicit.

Likely work:

- Decide what makes a Discord-authenticated user a staff user.
- Design the custom RBAC model before expanding protected routes.
- Protect all product API routes with the custom RBAC system, not ad hoc per-route checks.
- Update `apps/web/src/lib/api.ts` to include credentials for protected calls.
- Add consistent unauthorized/forbidden UI states.
- Avoid frontend-only authorization checks for sensitive behavior.

## Phase 4: First-Run Onboarding

Provide a first-host setup flow for new deployments after Discord OAuth login.

Flow:

- User starts the app stack, ideally through Docker Compose.
- Website asks the user to log in with Discord OAuth.
- After successful first login, redirect immediately to `/onboarding`.
- `/onboarding` uses a full-width and full-height page, separate from the normal app chrome.
- The page centers a modal-looking card with clear steps and progress.
- After onboarding completes, return users to the normal app layout and current pages.

Required onboarding steps:

- Link the primary Discord server.
- Link additional Discord servers to watch.
- Run the Discord bot invite process as needed for each selected server.
- Choose exactly one ticket-channel strategy:
  - Discord category with per-ticket channels.
  - Discord forum channel with per-ticket posts.
- Configure staff roles for each linked Discord server.
- Staff role permissions must be modular and future-editable. Start with at least `READ` and `MANAGE`; allow roles to have read-only access or read-plus-manage access. If no roles are set with RBAC, default to main Discord server ADMINISTRATOR permission requirement.

Backend considerations:

- Persist onboarding completion and linked server configuration.
- Treat incomplete onboarding as a setup state, not as an authorization bypass.
- Protect onboarding APIs with authenticated setup-owner access.
- Ensure the chosen channel strategy is exclusive per configured server/scope unless product requirements later expand it.
- Keep staff role permission checks server-aware.

Frontend considerations:

- `/onboarding` should not use the normal navbar/footer layout.
- Keep the card stepper reusable enough for future setup steps.
- Make skipped/incomplete/failed invite steps explicit and recoverable.

## Phase 5: Ticket Read Workflows

Polish the existing ticket list and ticket detail views.

Likely work:

- Wire status filtering fully through `useTickets(search, status)`.
- Improve loading, empty, and error states with shadcn primitives.
- Remove debug logs.
- Replace raw palette link classes with semantic tokens.
- Preserve message scroll restoration and grouping behavior.
- Consider debounce for search if API load becomes noisy.

## Phase 6: Ticket Mutations And Staff Actions

Add staff actions through protected API routes and service methods.

Likely work:

- Close/reopen tickets from UI.
- Add/remove tags.
- Add staff notes.
- Mark read or participant activity.
- Persist audit entries for state-changing actions.
- Keep Discord command behavior and web UI behavior consistent by reusing services.

## Phase 7: Settings

Build settings only after the desired configuration model is confirmed.

Current state:

- Backend `GET /settings` is unfinished.
- `SettingsService` needs to match the actual `config` table shape.
- Frontend `/settings` is a placeholder.

Likely work:

- Define the config response and update shape.
- Add protected read/update routes.
- Add a `features/settings/` UI with schemas, hooks, components, and validation.
- Handle singleton config initialization.
- Include post-onboarding edit surfaces for linked servers, ticket-channel strategy, and modular staff role permissions.

## Phase 8: Staff Surface

Build `/staff` after staff identity and authorization are defined.

Likely work:

- Staff roster/status overview.
- Staff permissions or allowed guild role mapping if needed.
- Staff activity or assignment views if product scope requires them.

Do not build a staff admin model from assumptions. Confirm authorization rules first.

## Phase 9: Discord Component And Template Management

Expose or improve component templates only after the staff permissions model exists.

Likely work:

- Validate DB-stored template JSON.
- Preview rendered Mustache variables safely.
- Keep component IDs stable.
- Add audit logging for template changes.

## Phase 10: Verification And Release Hygiene

Add quality gates proportional to the work.

Current state:

- `@imi/tickets-bot` has build and format scripts.
- `@imi/tickets-web` has build and lint scripts.
- Shared package tests: `pnpm test` (`@imi/tickets-shared` / vitest).

Recommended gates:

- Docs-only: reread docs and search for stale terms.
- Backend behavior: run `pnpm --filter @imi/tickets-bot build`; start manually if route loading or runtime behavior changed.
- Frontend behavior: run `pnpm --filter @imi/tickets-web lint` and `pnpm --filter @imi/tickets-web build`.
- Service logic: add a test runner before claiming automated coverage, or document manual verification.

## Cross-Cutting Constraints

- Do not reintroduce concepts from older unrelated context packs.
- Do not add Bun/Eden/TanStack Start/Gateway/NATS/Paddle guidance unless those tools are actually adopted.
- Keep API route contracts reflected in both backend docs and frontend API modules.
- Keep UI token guidance tied to `apps/web/src/App.css`.
- Keep staff/security-sensitive behavior enforced in the backend.
- Keep first-run onboarding and later settings edits backed by the same configuration/RBAC model.

