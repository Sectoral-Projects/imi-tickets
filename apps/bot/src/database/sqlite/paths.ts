import path from 'node:path';

/** Resolves DATABASE_FILE to an absolute path (strips optional quotes from .env). */
export function resolveDatabasePath(raw = process.env.DATABASE_FILE) {
	if (!raw) {
		throw new Error('DATABASE_FILE is not set');
	}

	return path.resolve(raw.replace(/^["']|["']$/g, ''));
}
