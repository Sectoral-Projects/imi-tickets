# Contributing

Thank you for considering contributing to imi/tickets!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env` at the repo root and fill in your Discord / OAuth credentials
4. Run in development mode: `pnpm dev:bot` and `pnpm dev:web`

## Project Structure

- `apps/bot` - Discord bot (TypeScript, Sapphire.js framework)
- `apps/web` - Staff web dashboard (React + Vite)
- `packages/shared` - Shared types, Zod schemas, and utilities

## Code Style

- Bot uses Prettier with `@sapphire/prettier-config`
- Web uses ESLint with React hooks plugin
- Both use TypeScript strict mode

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `pnpm build` passes
4. Run `pnpm test` for shared package tests
5. Submit a PR with a clear description

## Commit Messages

Use conventional-style messages:
- `feat: add ticket search`
- `fix: correct timeline scroll on mobile`
- `docs: update setup guide`
- `refactor: extract message row component`

## Reporting Issues

Please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Node.js and pnpm versions