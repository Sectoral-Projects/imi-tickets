import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { applySqliteMigrations } from './migrate';
import { resolveDatabasePath } from './paths';

/** Opens the app SQLite database with a single-file journal (no -wal / -shm sidecars). */
export function createSqliteDatabase(databaseFile = process.env.DATABASE_FILE) {
	const sqlite = new Database(resolveDatabasePath(databaseFile));
	sqlite.pragma('journal_mode = DELETE');

	const db = drizzle(sqlite);
	applySqliteMigrations(db, sqlite);
	return db;
}
