// Unless explicitly defined, set NODE_ENV as development:
process.env.NODE_ENV ??= 'development';

import { ApplicationCommandRegistries, RegisterBehavior } from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import { setup } from '@skyra/env-utilities';
import * as colorette from 'colorette';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { monorepoRoot } from './constants';

// Set default behavior to bulk overwrite
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

// Load monorepo-root `.env` when present (Docker injects env via compose instead).
const envPath = join(monorepoRoot, '.env');
if (existsSync(envPath)) {
	setup({ path: envPath });
}

// Enable colorette
colorette.createColors({ useColor: true });
