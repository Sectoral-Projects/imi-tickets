# UI Registry

Living registry for reusable `apps/web` patterns. Read this before building new UI, match existing patterns where they fit, and update this file after adding or materially changing a component.

Last backfill: 2026-07-07. Rebuilt from the current `apps/web` app and removed stale dashboard patterns from older context.

## How To Use

1. Search this file and `apps/web/src/components/ui/` before creating a new component.
2. Reuse an existing pattern if it fits.
3. If a new reusable pattern is needed, build it with shadcn primitives and semantic token classes.
4. Add the component path, usage, and important classes/pattern notes here.

## App Shell

### Root Router

**File:** `apps/web/src/main.tsx`

Uses `BrowserRouter`, `ThemeProvider`, `QueryClientProvider`, and a nested `Layout` route.

Routes:

| Route | Component |
| --- | --- |
| `/` | `App` route shell -> ticket list |
| `/:ticketId` | `Ticket` route shell -> ticket detail |
| `/onboarding` | Planned first-run setup; should render outside normal layout |
| `/staff` | `Staff` route shell -> staff analytics page |
| `/settings` | `Settings` route shell -> settings page |
| `/features` | `Features` route shell -> product features tour |
| `/about` | `About` route shell -> product overview |

### Layout

**File:** `apps/web/src/components/layout.tsx`

Pattern:

```tsx
<div>
  <Navbar />
  <Outlet />
  <Footer />
</div>
```

The layout imports `@/App.css`. Keep global layout concerns here instead of duplicating navbar/footer in route pages.

### Onboarding Shell

**Route:** `/onboarding`
**File:** `apps/web/src/Onboarding.tsx`

Registered outside the normal `Layout` route in `apps/web/src/main.tsx`, so setup can own the full viewport without navbar/footer chrome.

Layout pattern:

```tsx
className="min-h-dvh w-full bg-background text-foreground"
className="flex min-h-dvh items-center justify-center p-4 sm:p-6"
className="w-full max-w-5xl overflow-hidden" // wizard with sidebar
className="w-full max-w-md" // compact sign-in / loading states
```

The wizard card uses a two-column body:

- Left sidebar (`sm:w-52`, `bg-muted/20`, `border-r`) renders `StepSidebar` step navigation.
- Right content area renders the active step with Back/Next footer actions.

`Onboarding.tsx` is a thin route shell that renders `features/onboarding/components/onboarding-flow.tsx`.

Feature files:

- `features/onboarding/components/onboarding-shell.tsx` owns the full-screen centered card layout and optional sidebar slot.
- `features/onboarding/components/step-progress.tsx` exports `StepSidebar` for vertical step navigation with completed checkmarks.
- `features/onboarding/api/setup.ts` calls `/setup/*` routes through the shared API client.
- `features/onboarding/hooks/setup.ts` wraps setup status, guilds, resources, and mutations with TanStack Query.
- `features/onboarding/schemas/setup.ts` mirrors setup API responses with Zod schemas.

Step content pattern:

- Each step uses `StepHeader` (title + one-line description) instead of bordered info panels.
- Primary server selection uses full-width shadcn `Select`.
- Lists (servers, bot status, roles, review) use simple divided rows inside a single bordered container.

Implemented steps:

- Discord sign-in and setup-owner claim.
- Primary Discord server selection from OAuth `guilds` access.
- Optional additional watched server selection.
- Bot invite checks with Discord OAuth2 invite URLs.
- Exclusive channel strategy choice: category channels or forum posts.
- Per-server staff role permission matrix with `READ`, `MANAGE`, and `ADMIN`.
- Review and complete setup.

Staff roles step pattern:

- `StaffRolePermissionsEditor` uses Popover + Command for search, with a 3-way `ToggleGroup` per role (`None` / `Read` / `Manage`).
- Manage implicitly includes read permissions in the saved payload.
- Each switch segment uses a Lucide icon with a tooltip (`None`, `Read`, `Manage`).

### Navbar

**File:** `apps/web/src/components/navbar.tsx`

Uses:

- `authClient.useSession()`.
- `Button` for sign-in/sign-out.
- `ThemeToggle`.
- `NavigationMenu` on desktop.
- `Sheet` + `Accordion` on mobile.
- `Menu` and `LogOut` from `lucide-react`.

Notable classes:

```tsx
className="py-4"
className="hidden items-center justify-between lg:flex"
className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-accent-foreground"
className="block lg:hidden"
className="flex flex-col gap-6 p-4"
```

Known cleanup when editing:

- Replace internal `<a href>` navigation with React Router `Link`.
- Remove `console.log(auth)`.
- Keep sign-in callback URL and API origin aligned with environment config instead of hardcoding if adding environment support.

### Footer

**File:** `apps/web/src/components/footer.tsx`

Shared bottom page chrome. Keep footer updates here rather than per-route.

### Theme Toggle

**Files:**

- `apps/web/src/components/theme/provider.tsx`
- `apps/web/src/components/theme/toggle.tsx`

Use the existing next-themes provider/toggle. Do not create a second theme state system.

## shadcn Primitives

Installed under `apps/web/src/components/ui/`.

| Component | File | Notes |
| --- | --- | --- |
| Accordion | `accordion.tsx` | Mobile navbar grouped links |
| Avatar | `avatar.tsx` | Discord user avatars in ticket detail |
| Badge | `badge.tsx` | Ticket status |
| Button | `button.tsx` | Auth and actions |
| Card | `card.tsx` | Ticket cards and message groups |
| Switch | `switch.tsx` | Boolean settings toggles |
| Label | `label.tsx` | Settings form labels |
| Chart | `chart.tsx` | Installed, not central to current features |
| ContextMenu | `context-menu.tsx` | Available primitive |
| Input | `input.tsx` | Ticket search |
| NavigationMenu | `navigation-menu.tsx` | Desktop navbar |
| Resizable | `resizable.tsx` | Installed, not central to current features |
| ScrollArea | `scroll-area.tsx` | Ticket detail timeline scroll container (`viewportRef`, `onViewportScroll`) |
| Select | `select.tsx` | Ticket status filter |
| Separator | `separator.tsx` | Available primitive |
| Sheet | `sheet.tsx` | Mobile navbar |
| Tabs | `tabs.tsx` | Settings subsection navigation |

Add missing primitives with:

```text
pnpm dlx shadcn@latest add <component>
```

## Ticket Feature

Feature folder:

```text
apps/web/src/features/tickets/
  api/
  hooks/
  schemas/
  components/
  utils/
```

### Ticket List

**File:** `apps/web/src/features/tickets/components/list.tsx`  
**Export:** `TicketList`

Data:

- `useTickets(search, status)` from `hooks/tickets.ts`.
- `fetchTickets()` from `api/tickets.ts`.
- API response shape: `{ tickets, nextCursor }`.

Layout:

```tsx
className="flex min-h-0 flex-1 flex-col overflow-hidden" // page shell
className="shrink-0 p-4 md:p-6" // fixed search/filter header
className="relative min-h-0 flex-1 overflow-hidden" // scroll region
```

Controls (fixed above the virtualized list):

```tsx
<Input placeholder="Search tickets..." />
<SelectTrigger className="w-[160px]">
```

Virtualized list (`ScrollArea` + TanStack Virtual):

- `useTickets(search, status)` â€” status filter is wired through the hook (`null` when "all").
- `ScrollArea` viewport uses `viewportClassName="[overflow-anchor:none] [overscroll-behavior:contain]"`.
- `useVirtualizer` with `useFlushSync: false`, measured rows via `measureElement`, stable keys `ticket-${id}`.
- Standard downward infinite scroll: `fetchNextPage` when `distanceFromBottom <= 600px` (viewport `onScroll` + virtual-range re-check). No `anchorTo:"end"` â€” pages append at the bottom, unlike the chat timeline.
- Render items: ticket rows, optional bottom `load-sentinel`, optional `end-marker` card when exhausted.
- Filter/search changes reset `viewport.scrollTop = 0`.
- Component uses `"use no memo"` for React Compiler + `useVirtualizer` compatibility.

Card pattern:

```tsx
<Link to={`/${ticket.id}`}>
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="text-lg font-medium">
        <Badge className="text-sm">
    <CardContent>
      <div className="flex items-center gap-2">
        <div className="text-sm">
```

Known cleanup when editing:

- Replace plain loading/error text with token-styled states if improving polish.

### Ticket Detail

**File:** `apps/web/src/features/tickets/components/ticket.tsx`  
**Export:** `TicketContent`

Data:

- `useTicket(ticketId)` for ticket metadata.
- `useTimeline(Number(ticketId))` for normal paginated messages plus lifecycle audit entries.
- `fetchTimelineWindow()` for highlighted-message local windows around a target message.
- `buildTimelineBlocks()` from `utils/timeline/blocks.ts`.
- `formatAuditLabel()` from `utils/timeline/audit.ts`.

API:

- `GET /tickets/:ticketId/timeline?cursor=` returns `{ items, nextCursor }` where each item is `{ kind: "message", message }` or `{ kind: "audit", audit }`.
- `GET /tickets/:ticketId/timeline?messageId=` returns a local target window `{ items, previousCursor, nextCursor, anchorMessageId }`.
- `GET /tickets/:ticketId/timeline?windowCursor=&direction=older|newer` pages locally around a target-window boundary.
- Lifecycle audit actions rendered in the timeline: `thread.created`, `thread.closed`, `thread.reopened`, `thread.tag.added`, `thread.tag.removed`.

Top-level layout:

```tsx
className="flex h-full flex-col"
className="border-b p-4"
className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
```

Ticket header:

```tsx
className="shrink-0 border-b border-border p-4"
className="mb-2 text-lg font-semibold"
className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
```

Participants use `TicketHeaderParticipants` (`ticket-header-participants.tsx`): stacked avatars (`AvatarGroup`, max 3 + count), truncated summary (`Name +N`), and a click popover listing everyone with Member/Staff badges. Duplicate userId rows (member + staff) collapse into one person with merged roles. Single-user tickets stay non-interactive.

Message group card:

```tsx
<Card className="overflow-hidden p-0 gap-0">
  <div className="flex gap-3 p-4 ... transition-colors hover:bg-muted/40">
    <Avatar className="h-10 w-10">
    <span className="font-medium">
    <span className="text-xs text-muted-foreground">
    <div className="mt-1">
      <MessageContent message={message} />
    </div>
```

Message markdown (`message-markdown.tsx`):

- Ticket transcript text renders through `react-markdown` + `remark-gfm` with token-backed typography (headings, lists, links, code, blockquotes).
- Inline and fenced code use `bg-muted` + `border-border` chips so they stay visible on `bg-card` message shells.
- `preprocessMessageMarkdown()` in `utils/messages/markdown.ts` resolves Discord timestamps (`<t:…>`), turns legacy `<@id>` mentions into hoverable Discord profile links, and italicizes `-#` subtext lines before render.
- `stripMarkdown()` powers the plain-text copy variant.

```tsx
<MessageMarkdown content={message.content} />
```

Message copy menu (`message-copy-menu.tsx`):

- Each message row with text shows a bottom-right copy control on hover/focus (`group/message` + `group-hover/message:opacity-100`).
- The trigger is `absolute right-3 bottom-2` on the message row â€” it overlays the card padding and does not reserve extra body height.
- Dropdown offers **Copy with markdown** (raw stored content) and **Copy without markdown** (stripped plain text).
- Copy click handlers call `stopPropagation()` so highlight toggles do not fire.

```tsx
<div className="pointer-events-none absolute right-3 bottom-2 z-10 opacity-0 group-hover/message:opacity-100">
  <MessageCopyMenu content={message.content} />
</div>
```

Message edit indicator (`message-edit-indicator.tsx`):

- Shows `(edited)` beside timestamps when `revision > 1` or `updatedAt` is set.
- Click opens a popover with prior versions from `editHistory` (`Original`, `Edit 1`, â€¦) plus timestamp and markdown body.
- Popover click uses `stopPropagation()` so row highlight toggles do not fire.

```tsx
<MessageEditIndicator message={message} />
```

Message body media (`message-media.tsx`):

- Inline images, hosted video files, YouTube, and veed.io embeds render in the transcript via `MessageMedia`.
- Forwarded messages use `ForwardedMessageFrame` â€” italic `Forwarded` label with `Forward` icon and a left `bg-muted-foreground/35` rail, matching Discord's forward affordance.
- Non-media file attachments stay as semantic `text-primary` download links.
- Images use `max-h-80 max-w-full rounded-md border border-border object-contain`; spoiler attachments use `blur-sm hover:blur-none`.
- YouTube / veed.io use `aspect-video` iframes (`max-w-lg`).

```tsx
<div className="mt-2 flex flex-col gap-2">
  <MessageMedia attachment={attachment} />
</div>
```

Chained message row:

```tsx
className="group/message flex gap-3 px-4 pt-1 transition-colors hover:bg-muted/40"
className="opacity-0 transition-opacity text-[11px] text-muted-foreground content-center group-hover:opacity-100"
```

Lifecycle audit marker:

```tsx
<Marker variant="separator">
  <MarkerContent>Ticket opened</MarkerContent>
</Marker>
```

Uses `Marker` / `MarkerContent` from `components/ui/marker.tsx`.

Scroll behavior:

- Timeline renders oldestâ†’newest with the newest at the bottom.
- `useTimeline` reverses each API page (newest-first) and concatenates older pages before newer ones so multi-page order stays chronological. The API extends each base page by up to 30 adjacent rows to complete its boundary message group; each fetched page remains a hard visual-group boundary only as the fallback when one group exceeds that cap.
- `ScrollArea` wraps the timeline; `viewportRef` targets the scrollable viewport for scroll math and TanStack Virtual's `getScrollElement`.
- TanStack Virtual renders timeline blocks as measured virtual rows with `anchorTo: "end"` + `scrollEndThreshold: 80`. The virtual list contains only stable-keyed audit/message rows; loading status is an overlay outside it so a sentinel cannot become the prepend anchor.
- REQUIRED: the `ScrollArea` viewport carries `viewportClassName="[overflow-anchor:none] [overscroll-behavior:contain]"` so the browser's native scroll anchoring stops fighting the virtualizer's `anchorTo` adjustments (this was the root cause of drift/off-bottom bugs).
- `anchorTo: "end"` keeps the visible keyed item stable when older entries prepend and compensates above-viewport measurement deltas, so there is no manual `scrollTop` restoration. `followOnAppend` is on only in normal (non-highlighted) mode and keeps the view pinned when new realtime messages append while already at the bottom.
- Backward scrolling freezes already-cached row measurements (TanStack Virtual #659 mitigation), preventing media/markdown ResizeObserver churn from shifting following rows during the gesture. `estimateSize` accounts for group position and message content/media; overscan stays moderate at 10 rows so coarse unmeasured pages do not create a large temporary spacer.
- First load pins the bottom via `useLayoutEffect` + `rowVirtualizer.scrollToEnd()`, re-asserted every frame until the live DOM reports at-bottom for consecutive frames (verified pin, generous budget), then latched with `didInitialScrollRef`. There is NO manual `scrollTop = scrollHeight` (that used the estimated total size and left the view scrolled up) and no `stickToBottomRef`.
- Layout `main` uses `min-h-0 flex-1` so the ticket detail column can shrink and scroll internally.

Highlighted messages (`?messageId=1,2,3`):

- Interactive highlight toggles only update `?messageId=` and row styling; they do not change fetching or scroll position. A reload/deep link with highlights seeds a contiguous local window (`windowState`) around the oldest highlighted id and centers on it.
- The window only ever grows: `loadWindowPage("older"|"newer")` prepends/appends contiguous keyset pages. It never wholesale-replaces during infinite scroll, so keys stay stable and `anchorTo: "end"` keeps the view anchored.
- Infinite loading and the two chevrons share this one list. Loading triggers from the viewport `onScroll` handler using live `scrollTop`/`scrollHeight`, with one post-window-change edge check. A synchronous in-flight ref prevents duplicate loads before React state commits; virtual-range changes do not trigger loading because they race prepend anchoring.
- With 2+ highlights, floating `ChevronUp` / `ChevronDown` buttons (bottom-right) jump to the nearest highlighted target above/below. Targets are computed POSITIONALLY on every scroll â€” rendered rows by DOM rect, loaded-but-virtualized-out rows by `rowVirtualizer.measurementsCache` offsets, and not-yet-loaded highlights by message-id order vs the loaded window's chronological bounds. Never derive them from a remembered "active highlight" index; it goes stale the moment the user scrolls manually (missing/wrong-direction chevrons).
- Jump clicks supersede any centering loop still in flight via a generation counter ref (a stale loop exits without finalizing); they are never silently ignored.
- ALL jumps go through one measurement-aware centering loop (`finishPendingHighlightScroll`): phase 1 mounts the target block via `scrollToIndex(align:center)` (smooth issued once for in-window jumps; auto re-issued for seeds/seeks), phase 2 exact-centers the individual `[data-message-id]` row via `rowVirtualizer.scrollBy(delta)` once its element exists, finishing when stable for consecutive frames. NEVER pair a one-shot smooth `scrollToIndex` with a fixed-delay native `scrollIntoView` â€” the virtualizer clamps far targets to the estimated max offset and the row may not exist yet, which parked jumps at the bottom.
- Off-window jumps are a clean seek: while the window fetches, `SeekOverlay` shows a centered card with a spinner and short label over an opaque `bg-background` (no skeleton list, no blur). The viewport offset is reset to 0 before the new window commits (so `anchorTo: "end"` does not snap to the bottom).

Known cleanup when editing:

- Remove `console.log(messagesData)` if still present.
- Keep scroll-preservation logic intact.

### Message Grouping

**File:** `apps/web/src/features/tickets/utils/timeline/blocks.ts` (transcript)

Chains consecutive same-author, same-channel messages within two minutes. **Replies** and **private staff notes** always start a new solo group so they get lead chrome (avatar + reply snippet). The grouping predicate is shared with backend pagination through `packages/shared/src/timeline.ts`; changes to author/channel/time/reply/private semantics must be made there so page completion and visual grouping stay aligned.

Helper `apps/web/src/features/tickets/utils/messages/groups.ts` remains for simpler list grouping without reply/private rules.

## API And Query Patterns

### Shared API Client

**File:** `apps/web/src/lib/api.ts`

Current shape:

```ts
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(API_BASE + path);
    // ...
  },
};
```

Known cleanup when editing:

- Remove debug logging.
- Add `credentials: "include"` before using protected Better Auth routes.
- Keep API base centralized here.

### Ticket Query Hooks

**File:** `apps/web/src/features/tickets/hooks/tickets.ts`

Patterns:

- `useInfiniteQuery` for ticket lists.
- Query key: `["tickets", search, status]`.
- `select` flattens pages into `tickets`.
- `useQuery` for single ticket.

### Message Query Hooks

**File:** `apps/web/src/features/tickets/hooks/timeline.ts`

Patterns:

- `useInfiniteQuery` for ticket timeline (messages + lifecycle audit entries).
- Query key: `["timeline", ticketId]`.
- `select` flattens pages oldestâ†’newest: reverse page order, reverse items within each page.
- Reverses paginated items into oldestâ†’newest order for chat display.

**File:** `apps/web/src/features/tickets/hooks/messages.ts`

Patterns:

- Legacy message-only pagination hook; ticket detail uses `useTimeline` instead.
- Query key: `["messages", threadId]`.
- `select` flattens pages and reverses to oldest-to-newest.
- `enabled: Boolean(threadId)`.

### Settings Page

**Route:** `/settings`  
**File:** `apps/web/src/Settings.tsx` -> `features/settings/components/settings-page.tsx`

Data:

- `useSettings()` for `GET /settings`.
- `useUpdateSettings()` for `PATCH /settings` (requires `MANAGE`).

API response:

```ts
{
  settings: AppSettings;
  logChannelId: string | null;
  transcriptChannelId: string | null;
  channelPanel: ChannelPanelView;
  canManage: boolean;
  canAdmin: boolean;
}
```

Page-level tabs split General (privacy, tickets, channel ticket panel, Discord channels), Templates, and Data & privacy (ADMIN only). One global `Save changes` button persists general settings, template builder edits (including DM and channel open buttons), and ticket-open mode. **Publish panel** on the channel ticket panel card posts immediately via `POST /settings/channel-panel/publish` and does not use the page save button.

Layout:

```tsx
className="flex min-h-0 flex-1 flex-col overflow-hidden" // page shell
<ScrollArea className="min-h-0 flex-1" viewportClassName="overscroll-behavior-contain [overflow-anchor:none]" />
```

- Header + tab list stay fixed above the scroll region; save footer stays fixed below.
- Tab content scrolls only inside `ScrollArea` â€” never on `html`/`body` or the page shell.

### Channel Ticket Panel Settings

**File:** `apps/web/src/features/settings/components/channel-panel-settings.tsx`

Exports `ChannelPanelSettingsSection` for the General tab:

- Enable toggle, panel channel picker (text + forum via `GET /settings/panel-channels`)
- Optional forum post picker (`GET /settings/channel-panel/forum-threads`) or auto-create title
- **Publish panel** button
- Edit panel message/buttons in Templates â†’ `ticket-channel-panel` (includes per-button **Ticket subject template** Mustache field)

Channel open buttons persist through `PUT /settings/channel-open-buttons` when saving template edits.

Layout pattern:

```tsx
className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6"
<Tabs defaultValue="general" className="flex flex-col gap-6">
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="templates">Templates</TabsTrigger>
    <TabsTrigger value="data-privacy">Data & privacy</TabsTrigger> // ADMIN only
  </TabsList>
</Tabs>
```

Sections use `Card` groups for Bot prefixes, Message filters, Privacy, Tickets, channel ticket panel, and Discord channels. Boolean options use `Switch` + `Label` rows. Staff without `MANAGE` see a read-only badge and disabled controls. Staff with `ADMIN` see the Data & privacy tab for bulk deletion and GDPR export/anonymize/erase.

### Author hover card

**File:** `apps/web/src/features/tickets/components/author-hover-card.tsx`

Wraps lead avatar/name on message groups. Snapshot identity stays on the row; hover fetches `GET /discord/users/:userId` via `useDiscordUser` (`staleTime` 5 minutes). Synthetic/non-snowflake authors skip the card. When the bot resolves primary-guild membership with roles, the card lists them (excluding `@everyone`, highest first) as outline badges with a Discord role-color swatch (max 8, then `+N more`). Empty or unresolved role lists omit the block.

System profile transcript rows store display names as Discord profile markdown links (`https://discord.com/users/:id`). `MessageMarkdown` turns those (and legacy `<@id>` mentions) into `UserMentionLink` hover cards; role mentions in older rows normalize to plain "Role" text while new rows store role names.

### Message reaction hover card

**File:** `apps/web/src/features/tickets/components/message-reactions.tsx`

Each reaction chip opens a `HoverCard` listing every `userIds` reactor for that emoji. Fetches profiles only while open via `useDiscordUser` (same cache as author cards). Header shows the emoji + count; body is a scrollable avatar/name list. Trigger click uses `stopPropagation` so highlight toggles do not fire.

Unicode reaction glyphs render via `@discordapp/twemoji` (`ReactionEmoji` + `lib/twemoji.ts` → SVG from Discord’s pinned `jdecked/twemoji@16.0.1` asset base). Custom Discord emoji keep `cdn.discordapp.com/emojis/...`.

Message body text also uses Twemoji through `TwemojiText` inside `MessageMarkdown`. Emoji-only messages (unicode and/or `<:name:id>` / `<a:name:id>`, whitespace allowed, max 27 emoji) get Discord-style jumbo sizing (`size-12`); mixed text stays at ~1.375em inline.

### Data & Privacy Settings

**File:** `apps/web/src/features/settings/components/data-privacy-settings.tsx`

Exports:

- `DataPrivacySettingsSection` for the Data & privacy tab (requires `canAdmin`).

API:

- `features/settings/api/privacy.ts` â€” `previewDataDeletion`, `executeDataDeletion`, `downloadGdprExport`, `processGdprUser`.
- `features/settings/schemas/privacy.ts` â€” category labels, confirmation strings, preview types.

Layout pattern:

```tsx
<div className="space-y-6">
  <Card className="border-destructive/40"> // dangerous bulk delete
  <Card> // GDPR subject requests
</div>
```

Interaction pattern:

- Bulk delete uses `Checkbox` per `DataCategory`, preview counts, then typed `DELETE DATA` confirmation before `POST /settings/data/delete`.
- GDPR section accepts a Discord snowflake user ID; export downloads JSON via raw `fetch` + blob.
- Anonymize requires `ANONYMIZE USER`; full erasure requires `ERASE USER` and uses destructive button styling.
- Help text explains anonymization assigns one new random ID across records and scrubs references in all ticket messages (including staff).

### Template Settings Sections

**File:** `apps/web/src/features/templates/components/template-settings-panel.tsx`

Exports:

- `TemplatesSettingsSection` for the Templates tab.

Builder files:

- `features/templates/components/component-builder.tsx`
- `features/templates/components/accent-color-picker.tsx`
- `features/templates/components/template-preview.tsx`
- `features/templates/components/create-template-dialog.tsx`
- `features/templates/components/modal-builder.tsx`
- `features/templates/components/modal-preview.tsx`
- `features/templates/utils/modal-v2.ts`
- `features/templates/utils/template-variables.ts`
- `features/templates/schemas/button-actions.ts`

Usage:

- Embedded in `/settings` page tabs as the admin surface for Component V2 template overrides, custom templates, and ticket-open prompt buttons.
- Uses `Card`, `Select`, `Input`, `Textarea`, `Switch`, `Badge`, `Separator`, `Dialog`, `Tooltip`, and `Button`.
- Reads/writes through `features/templates/api/templates.ts` and TanStack Query hooks in `features/templates/hooks/templates.ts`.

Layout pattern:

```tsx
className="flex flex-col gap-4" // tab section stacks
className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]" // builder + preview (Card uses overflow-visible)
className="min-h-0 self-stretch" // preview column stretches with builder height
className="md:sticky md:top-4 md:max-h-[calc(100svh-8rem)] md:overflow-y-auto" // preview follows scroll inside column
className="flex flex-col gap-3" // compact card form bodies
```

Interaction pattern:

- Settings page owns one global `Save changes` action for general settings and template edits.
- Template edits are draft-only until page save; destructive reset/delete still run immediately.
- Each selected template has a general `Enabled` switch (system and custom).
- `ticket-open-prompt` adds ticket opening mode (Open immediately / Wait for button), forward-to-staff toggle, and DM-open button fields (optional tag) in the builder.
- Each button supports **Button action**: `Send component message` (links a component message template) or **Open modal form** (links a modal template + optional submit template).
- Modal templates (`category: modal`) are first-class templates with their own builder (`ModalBuilder`), field blocks, and live preview (`ModalPreviewPanel`).
- **New template** dialog creates either a component message or modal form template.
- Component message templates show **From linked modals** variables when used as a modal submit target; field IDs from the linked modal appear as `{{fieldId}}` in the variables list.
- Member-facing templates with buttons (`created`, `auto-close-reminder`, custom) show the forward-to-staff toggle (`settings.forwardTemplateButtonsToStaff`). Staff-only, channel-only, and pre-ticket templates (e.g. `blocked`, `audit-log`, `staff-ticket-open-profile`) do not.
- All templates support the `Add` menu for text blocks or buttons; non-prompt buttons are stored in the template JSON.
- Custom templates are created through a `New template` dialog (ID + name), then edited in the builder.
- Component builder supports drag-reorderable text blocks, accent color, and debounced preview rendering.
- Text blocks use `VariableHighlightTextarea` â€” `{{variable}}` and `{{{variable}}}` tokens render with `text-primary font-medium` and `bg-primary/10` behind a transparent textarea while editing.
- Drag reorder uses the grip handle only so textarea text selection still works normally.
- Accent color uses a Popover color wheel (`react-colorful`) with Discord preset swatches.
- Template preview uses Discord Component V2 styling (`discord-preview-*` tokens in `App.css`).
- System components without a SQLite override show the full code default from `apps/bot/src/lib/components/` in the builder, with sample variables for live preview. Badge: `Code default`.

### Settings Tabs

File: `apps/web/src/components/ui/tabs.tsx`
Last updated: 2026-07-08

| Property | Class |
| --- | --- |
| Background | `bg-muted`, `data-active:bg-background` |
| Border | `border-transparent`, `focus-visible:border-ring` |
| Border radius | `rounded-lg`, `rounded-md` |
| Text â€” primary | `text-foreground`, `data-active:text-foreground` |
| Text â€” secondary | `text-muted-foreground`, `text-foreground/60` |
| Spacing | `gap-2`, `gap-1.5`, `p-[3px]`, `px-1.5`, `py-0.5` |
| Hover state | `hover:text-foreground` |
| Shadow | `data-active:shadow-sm` |
| Accent usage | `focus-visible:ring-ring/50`, line variant `after:bg-foreground` |

Pattern notes: Use `Tabs` for sibling settings subsections that belong on one route but should not share the same card body. Place `TabsTrigger` items inside `TabsList`, and keep `TabsContent` panels as `flex flex-col gap-4` lanes with standalone cards for each major form area.

## Marketing Pages

Feature folder:

```text
apps/web/src/features/site/
  components/
    feature-showcase.tsx
    features-page.tsx
    about-page.tsx
```

### Features Page

**Route:** `/features`  
**Files:** `apps/web/src/Features.tsx` -> `features/site/components/features-page.tsx`

Layout pattern:

```tsx
className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-10 sm:px-6 sm:py-14"
className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12" // FeatureShowcase
className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" // extra feature cards
```

Uses public screenshot assets:

- `/tickets-list.png`
- `/ticket.png`
- `/staff-analytics.png`
- `/settings-general.png`
- `/settings-templates.png`

`FeatureShowcase` alternates image + copy; pass `reverse` for every other row. Additional bot/backend features use icon `Card size="sm"` grid without screenshots.

### About Page

**Route:** `/about`  
**Files:** `apps/web/src/About.tsx` -> `features/site/components/about-page.tsx`

Layout pattern:

```tsx
className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-10 sm:px-6 sm:py-14"
className="grid gap-4 sm:grid-cols-3" // pillar cards
```

Explains what imi/tickets is, a three-step how-it-works flow, and links to `/features`.

Footer links (`components/footer.tsx`) use React Router `Link` to `/about` and `/features`.

## Staff Analytics

**Route:** `/staff`
**Files:** `apps/web/src/Staff.tsx`, `features/staff/components/staff-page.tsx`

Layout pattern:

```tsx
className="flex flex-col gap-6"
className="grid gap-4 sm:grid-cols-3" // stat cards row
className="grid gap-4 md:grid-cols-2" // staff member cards
```

Stat overview (`Card size="sm"` â€” single bento panel, not a stretched 3-card grid):

- Left: compact 2-column metrics (`Total tickets`, `In progress`).
- Right: horizontal top-3 podium (avatar + count); `#1` gets subtle emphasis; empty slots use dashed placeholders.
- Page loading: `staff-page-skeleton.tsx` (full page), plus `StaffChartSkeleton` / `StaffMemberCardsSkeleton` for partial loads.

Filters sync to URL search params for shareable views: `search`, `action`, `days` or `from`/`to`, `staff` (defaults omitted). Date range uses a popover with calendar + presets (native `Date` only).

## Known Legacy Exceptions

These are current code issues or drift points. Match the intent of the docs when building new UI; clean these up only when touching the same area or when requested.

| File | Exception |
| --- | --- |
| `apps/web/src/lib/api.ts` | Debug `console.log`; no credentials in fetch yet. |
| `apps/web/src/components/navbar.tsx` | Debug `console.log`; some internal navigation uses `<a href>`; sign-in callback is hardcoded. |
| `apps/web/src/features/tickets/components/list.tsx` | Virtualized list; no known functional drift. |
| `apps/web/src/features/tickets/components/ticket.tsx` | Debug `console.log`; attachment links use `text-blue-500`. |
| `apps/web/src/index.css` | Legacy starter/root styling remains; `App.css` is the token source of truth. |
| `apps/web/src/main.tsx` | `/onboarding` is planned and should be outside the normal `Layout` route. |

## When Adding A New Component

1. Search this file and `apps/web/src/components/ui/` first.
2. Reuse shadcn primitives and existing feature patterns.
3. Keep route shells thin and place real UI under `src/features/`.
4. Use semantic token classes only.
5. Add a section here with file path, usage context, and important classes or behavior.

