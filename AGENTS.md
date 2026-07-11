# Read Before Anything Else

## Monorepo Layout

This is a pnpm monorepo:

- `apps/bot` - Discord bot + Hono API + SQLite
- `apps/web` - Vite React staff UI
- `packages/shared` - shared API types/schemas
- `docs/` - human setup/architecture/docker docs
- `context/` - agent context (paths use `apps/bot` and `apps/web`)

Read in this exact order before any implementation:

1. context/project-overview.md
2. context/architecture.md
3. context/ui-tokens.md
4. context/ui-rules.md
5. context/ui-registry.md
6. context/code-standards.md
7. context/library-docs.md
8. context/build-plan.md
9. context/progress-tracker.md

Item-level roadmap scope and live progress status come from `progress-tracker.md`.

# Rules That Never Change

- Terminal is Windows PowerShell - use PowerShell commands and syntax (see `context/code-standards.md` Shell / Terminal)
- Never use hardcoded hex values or raw Tailwind color classes
- Update Linear issues and `ui-registry.md` after every feature
- Before any third party library - load its installed skill first, then read `context/library-docs.md` for project-specific rules
- If the same problem persists after one corrective prompt - stop immediately and run /recover

# Available Skills
- `/architect` - before any complex feature. Think before building.
- `/imprint` - after any new UI component. Capture patterns.
- `/review` - before demo or when something feels off.
- `/recover` - when something breaks after one failed correction.
- `/remember save` - when a feature spans multiple sessions.
- `/remember restore` - when returning after a multi-session feature.