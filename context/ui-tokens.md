# UI Tokens

Design-token guidance for the `apps/web` staff app. The token source of truth is in the sibling frontend repo, not in `apps/bot`.

## Source Of Truth

Primary token file:

```text
g:/Programming/nw-apps/bot/apps/web/src/App.css
```

shadcn config:

```text
g:/Programming/nw-apps/bot/apps/web/components.json
```

Current shadcn settings:

- Style: `base-nova`.
- Base color: `mist`.
- Runtime: client-only Vite SPA (`rsc: false`).
- Icons: `lucide`.
- CSS variables: enabled.
- RTL: enabled.
- Important aliases in `components.json`: `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`.
- Vite/TypeScript alias in code: `@/*` maps to `src/*`, so imports usually look like `@/components/ui/button`.
- Do not use `@/src/...` in `components.json` aliases. The shadcn CLI treats those as literal folders and will create a top-level `@` directory.
- The shadcn CLI reads path aliases from the root `tsconfig.json`, not only `tsconfig.app.json`. Keep `@/*` -> `./src/*` in the root file when using Vite project references.

Use pnpm when adding shadcn primitives:

```text
pnpm dlx shadcn@latest add <component>
```

## How Tailwind Tokens Work

The app uses Tailwind CSS v4 through `@tailwindcss/vite`. `src/App.css` imports Tailwind, `tw-animate-css`, shadcn's Tailwind layer, and variable fonts.

Tokens are defined as CSS variables in `:root` and `.dark`, then mapped through `@theme inline`.

Examples:

```tsx
// Correct: semantic token classes
className="bg-background text-foreground border-border"

// Correct: shadcn card tokens
className="bg-card text-card-foreground"

// Avoid in new UI: raw palette class
className="text-blue-500"

// Never: hardcoded hex color
className="bg-[#ffffff]"
```

## Token Families

`src/App.css` currently defines light and dark values for:

- App surface: `background`, `foreground`.
- Content surfaces: `card`, `card-foreground`, `popover`, `popover-foreground`.
- Actions: `primary`, `primary-foreground`, `secondary`, `secondary-foreground`.
- Subtle UI: `muted`, `muted-foreground`, `accent`, `accent-foreground`.
- Controls and feedback: `destructive`, `border`, `input`, `ring`.
- Charts: `chart-1` through `chart-5`.
- Sidebar-ready tokens: `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`.
- Radius scale: `radius-sm` through `radius-4xl`.
- Discord template preview: `discord-preview-canvas`, `discord-preview-surface`, `discord-preview-foreground`, `discord-preview-muted`, `discord-preview-timestamp` (used only in the template builder preview panel).
- Fonts: `font-sans` uses Inter Variable; `font-heading` uses Roboto Variable.

## Preferred Classes

Use semantic classes:

```text
bg-background
text-foreground
bg-card
text-card-foreground
bg-popover
text-popover-foreground
bg-muted
text-muted-foreground
bg-accent
text-accent-foreground
border-border
ring-ring
bg-primary
text-primary-foreground
bg-secondary
text-secondary-foreground
bg-destructive
```

For links, prefer a semantic treatment such as `text-primary underline` instead of raw blue palette classes.

## Component Patterns

- Use `cn()` from `apps/web/src/lib/utils`.
- Use shadcn primitives from `apps/web/src/components/ui/` before creating one-off markup.
- Use `lucide-react` for icons.
- Use `next-themes` through the existing provider and toggle.
- Use chart tokens with Recharts if charts become part of a real feature.

## Known Token Drift

These are existing exceptions to record and clean up when editing the same surface:

| File | Exception |
| --- | --- |
| `apps/web/src/features/tickets/components/ticket.tsx` | Attachment links use `text-blue-500`; prefer `text-primary` in future work. |
| `apps/web/src/index.css` | Contains legacy Vite starter/root styles alongside `App.css`; do not treat it as the design-token source of truth. |

New UI should use semantic tokens from `App.css`.

## Adding Or Changing Tokens

Only add a token when it represents a reusable design-system concept. Add both light `:root` and `.dark` values, map it in `@theme inline` if Tailwind utilities need it, then use the semantic class in components.

Do not add feature-specific color variables for one-off styling.

