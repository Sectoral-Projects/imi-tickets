import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';
import { resolveDatabasePath } from './src/database/sqlite/paths';

config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
	out: './drizzle',
	schema: ['./src/database/sqlite/schema.ts', './src/database/sqlite/auth.ts'],
	dialect: 'sqlite',
	strict: false,
	dbCredentials: {
		url: resolveDatabasePath()
	},
	breakpoints: true
});
