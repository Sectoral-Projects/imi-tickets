import { join } from 'path';

/** Package root (`apps/bot`), whether running from `src` or `dist`. */
export const rootDir = join(__dirname, '..', '..');
export const srcDir = join(rootDir, 'src');
/** Monorepo root — single shared `.env` for bot, web, and Docker. */
export const monorepoRoot = join(rootDir, '..', '..');
