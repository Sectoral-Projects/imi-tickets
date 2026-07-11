import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Hono } from 'hono';
import { resolveRoutePath } from './resolve';
import type { ApiEnv } from './context';

const isFile = (file: string) => /\.(js)$/.test(file);

async function walk(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });

	const files = await Promise.all(
		entries.map((entry) => {
			const res = path.resolve(dir, entry.name);
			return entry.isDirectory() ? walk(res) : res;
		})
	);

	return files.flat();
}

export async function loadRoutes(app: Hono<ApiEnv>) {
	const routesDir = path.resolve('./dist/routes');

	const files = (await walk(routesDir)).filter(isFile);

	for (const file of files) {
		const modPath = pathToFileURL(file).href;
		const mod = await import(modPath);

		const RouteClass =
			mod.default?.default ?? mod.default ?? mod;

		if (typeof RouteClass !== 'function') {
			throw new Error(`Route ${file} did not export a class`);
		}

		const instance = new RouteClass();

		const routePath = resolveRoutePath(file, routesDir);

		console.log(`🧩 ${file} → ${routePath}`);

		instance.register(app, routePath);
	}
}