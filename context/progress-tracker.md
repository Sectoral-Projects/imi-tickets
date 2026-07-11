# Progress Tracker

This file tells agents how to handle progress and roadmap state for the `imi/tickets` pnpm monorepo (`apps/bot`, `apps/web`, `packages/shared`).

## Source Of Truth

No authoritative issue tracker was found in the repos when this file was rewritten. Do not assume an older unrelated Linear project applies to this codebase.

Until the user identifies a tracker:

- Treat local code and context files as the source for current implementation reality.
- Treat `build-plan.md` as durable phase guidance, not live status.
- Ask the user which tracker to use before creating, updating, or closing roadmap items.
- Do not invent issue IDs, Linear project names, assignees, labels, or completion states.

If the user later connects Linear, GitHub Issues, or another tracker, that tracker becomes the live source for item-level scope, status, priority, assignee, comments, and acceptance criteria.

## Read Progress Context When

1. Starting any backend, UI, docs, auth, database, Discord bot, or roadmap task.
2. The user mentions a phase, issue, ticket, milestone, project status, or next task.
3. Selecting work to do next.
4. Finishing work that changes behavior, contracts, UI patterns, docs, or verification expectations.

## What To Check Locally

Before planning implementation, inspect the relevant local areas:

| Area | Check |
| --- | --- |
| Product/system shape | `context/project-overview.md`, `context/architecture.md` |
| Coding rules | `context/code-standards.md`, `context/library-docs.md` |
| UI work | `context/ui-tokens.md`, `context/ui-rules.md`, `context/ui-registry.md`, `apps/web/src/components`, `apps/web/src/features` |
| Backend API | `apps/bot/src/routes`, `apps/bot/src/services`, `apps/bot/src/lib/api` |
| Discord bot | `apps/bot/src/commands`, `apps/bot/src/listeners`, `apps/bot/src/lib/components` |
| Database | `apps/bot/src/database/sqlite/schema.ts`, `apps/bot/src/database/sqlite/auth.ts`, `apps/bot/drizzle` |
| Roadmap shape | `context/build-plan.md` |

## Updating Progress

If a real tracker is configured:

- Read the issue and comments before implementation.
- Keep status changes aligned with actual work state.
- Add comments for important decisions, blockers, verification results, and handoff notes.
- Do not mark work complete before verification, unless the user explicitly accepts deferred verification.

If no tracker is configured:

- Do not create a fake markdown checklist in this file.
- Summarize completed work in the chat final response.
- Update context docs only when conventions, architecture, or reusable UI patterns changed.
- Ask the user where progress should be recorded if they request persistent tracking.

## UI Registry Updates

Update `ui-registry.md` after adding or materially changing reusable UI components or patterns in `apps/web`.

Include:

- Component path.
- Usage context.
- Important composition/classes.
- Known exceptions or follow-up cleanup if the implementation intentionally preserves existing drift.

Do not add every small markup change to the registry. Record patterns future agents should copy or avoid.

## Context Updates

Update context files when:

- The stack changes.
- A new durable architecture boundary is introduced.
- API contracts change.
- A new service/database pattern becomes standard.
- A frontend feature establishes a reusable UI pattern.
- Verification or tooling expectations change.

Do not duplicate detailed issue descriptions or transient task status into context files.

## Do Not Do

- Do not reference an older unrelated Linear project for this repo.
- Do not treat `build-plan.md` as live status.
- Do not mark work complete in markdown while leaving the real tracker stale.
- Do not create roadmap issues without user direction or an identified tracker.
- Do not update `AGENTS.md` unless the user permits edits outside `context/` at the monorepo root.

