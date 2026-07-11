import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

type Journal = {
	entries: Array<{ tag: string; when: number }>;
};

/** SQL migrations live at apps/bot/drizzle (next to dist/, not inside it). */
export function resolveMigrationsFolder() {
	return path.join(__dirname, '..', '..', '..', 'drizzle');
}

/**
 * Applies pending Drizzle SQL migrations. Safe to call on every startup.
 *
 * Databases previously created with `drizzle-kit push` (no migration journal rows)
 * are baselined so existing tables are not re-created.
 */
export function applySqliteMigrations(db: BetterSQLite3Database, sqlite: Database.Database) {
	const migrationsFolder = resolveMigrationsFolder();
	baselinePushCreatedDatabase(sqlite, migrationsFolder);
	migrate(db, { migrationsFolder });
}

function baselinePushCreatedDatabase(sqlite: Database.Database, migrationsFolder: string) {
	const hasConfig = sqlite
		.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'config'")
		.get();
	if (!hasConfig) {
		return;
	}

	const hasMigrationsTable = sqlite
		.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
		.get();
	if (hasMigrationsTable) {
		const row = sqlite.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations').get() as {
			count: number;
		};
		if (row.count > 0) {
			return;
		}
	}

	const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
	const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as Journal;
	const last = journal.entries.at(-1);
	if (!last) {
		return;
	}

	const sqlContent = fs.readFileSync(path.join(migrationsFolder, `${last.tag}.sql`), 'utf8');
	const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');

	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS __drizzle_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hash text NOT NULL,
			created_at numeric
		)
	`);
	sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(hash, last.when);
}
