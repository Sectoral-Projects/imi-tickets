# UI Rules

Concise rules for building or changing the `apps/web` staff interface.

## Default: shadcn/ui

Build UI with existing shadcn primitives from `apps/web/src/components/ui/` and semantic styling from `ui-tokens.md`.

- Start with existing primitives such as `Button`, `Card`, `Input`, `Badge`, `Select`, `Sheet`, `NavigationMenu`, `Avatar`, and `Separator`.
- Use token-backed classes such as `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, and `bg-card`.
- Install missing standard primitives with `pnpm dlx shadcn@latest add <component>`.
- Check `ui-registry.md` before adding a new component pattern.

Only write custom markup when a feature needs a shape that shadcn primitives do not express cleanly.

## App Layout

The app is a Vite SPA with React Router routes declared in `apps/web/src/main.tsx`.

Current layout:

```tsx
<BrowserRouter>
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<App />} />
          <Route path="/:ticketId" element={<Ticket />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  </ThemeProvider>
</BrowserRouter>
```

`Layout` wraps `Navbar`, `Outlet`, and `Footer`. Do not add a separate route system or TanStack Start file tree.

Planned exception: `/onboarding` should render outside the normal `Layout` so first-run setup can use a full-width and full-height page without navbar/footer chrome.

## Onboarding

The first-run onboarding UI should be a focused setup flow after Discord OAuth login.

Route and layout:

- Path: `/onboarding`.
- Full viewport width and height.
- No normal navbar/footer layout while onboarding is active.
- Center a modal-looking card with steps and progress.
- After completion, redirect back into the normal app pages/layout.

Step content:

- Link primary Discord server.
- Link additional Discord servers to watch.
- Start or guide the bot invite flow as needed for each server.
- Select one ticket-channel strategy: Discord category channels or Discord forum-channel posts.
- Configure staff roles per Discord server.
- Staff role permissions must be modular. Start with `READ`, `MANAGE`, and `ADMIN`, and keep the UI easy to extend for future permission flags.
- `READ` is for viewing tickets/transcripts on the staff site.
- `MANAGE` is for most Discord staff commands (close, contact, rename, logs, etc.).
- `ADMIN` unlocks `/settings` editing and sensitive commands such as `block` / `unblock`.

Interaction rules:

- Make incomplete setup recoverable.
- Show invite/link failures clearly.
- Do not imply a role has global access when permissions are server-specific.
- Use backend RBAC state as the source of truth; UI checks are only affordances.

## Navigation

Navbar behavior lives in `apps/web/src/components/navbar.tsx`.

- Unauthenticated users see logo, theme toggle, and Discord sign-in.
- Authenticated users see desktop navigation, mobile sheet navigation, theme toggle, and sign-out.
- Use React Router `Link` for new internal navigation. Existing `<a href>` usage can be cleaned up when touching navbar work, but avoid unrelated churn.
- Use shadcn `Button`, `NavigationMenu`, `Sheet`, and `Accordion` for nav interactions.
- Remove debug `console.log` calls when editing the surrounding code.

## Ticket List

The ticket list lives in `apps/web/src/features/tickets/components/list.tsx`.

Patterns to preserve:

- `useTickets()` owns TanStack infinite-query behavior.
- `fetchTickets()` builds query params for `cursor`, `search`, and `status`.
- List cards use shadcn `Card`, `CardHeader`, `CardContent`, and `Badge`.
- Search uses `Input`.
- Status filtering uses `Select`.
- Infinite scroll uses an `IntersectionObserver` sentinel.

When improving this surface:

- Include `status` in `useTickets(search, status)` calls when the filter is meant to affect the query.
- Prefer stable IDs for keys (`ticket.id`) instead of array index when editing the list.
- Keep empty/loading/error states styled with semantic tokens.

## Ticket Detail And Messages

The ticket detail view lives in `apps/web/src/features/tickets/components/ticket.tsx`.

Patterns to preserve:

- `useTicket(ticketId)` loads ticket metadata.
- `useMessages(threadId)` loads paginated messages.
- Messages render oldest-to-newest after the hook reverses flattened pages.
- Older history loads from the top sentinel.
- Scroll position is preserved when older messages are prepended.
- Initial load scrolls to the newest message.
- `groupMessages()` groups consecutive messages by author within a two-minute window.
- Message cards use `Card`, `Avatar`, `Badge`, and semantic text classes.

When editing attachments, replace existing raw `text-blue-500` links with semantic link styling such as `text-primary underline`.

## Data And Auth Awareness

- UI API modules call `apps/web/src/lib/api.ts`.
- Better Auth client lives in `apps/web/src/lib/auth-client.ts`.
- API base URL comes from `VITE_API_URL`, defaulting to `http://localhost:4000`.
- Authenticated/protected calls should go through the shared fetch wrapper with credentials.
- Product data calls should expect custom RBAC enforcement from the backend. Do not rely on frontend-only permission checks.
- Do not call Discord APIs or access SQLite from frontend code.

## Feature Structure

For new frontend features, follow:

```text
src/features/<feature>/
  api/
  hooks/
  schemas/
  components/
  utils/        optional
```

Route files should render one feature-level component and avoid inline data logic.

## Styling

- Use semantic token classes from `ui-tokens.md`.
- Use `cn()` for conditional class names.
- Use `font-heading` only when a heading needs the Roboto heading token; otherwise normal text inherits `font-sans`.
- Keep spacing simple: flex/grid gaps, card padding, and shadcn primitive defaults.
- Do not hardcode hex values.
- Do not introduce raw palette classes in new UI.

## Accessibility And Interaction

- Prefer real buttons for actions and links for navigation.
- Keep keyboard navigation intact for menus, sheets, and selects by using shadcn primitives.
- Use visible text labels or accessible labels for icon-only controls.
- Preserve message scroll behavior when changing the ticket detail layout.

## Current Incomplete Surfaces

- `/staff` is a placeholder.
- `/settings` is a placeholder, and the backend `GET /settings` route/service are unfinished.
- `/onboarding` is planned and should become the first-run setup flow.
- There is no complete protected staff authorization model in the UI yet.

Treat these as planned work, not established patterns.

