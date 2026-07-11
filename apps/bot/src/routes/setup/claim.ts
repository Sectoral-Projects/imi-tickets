import { requireSession } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { SetupService } from '@/services/setup';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

export default class SetupClaim extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.post(path, (c) => this.claim(c));
	}

	async claim(c: Context<ApiEnv, string, BlankInput>) {
		const denied = requireSession(c);
		if (denied) return denied;

		SetupService.claimSetupOwner(c.get('user')!.id);

		return c.json(SetupService.getStatus(c.get('user')!.id));
	}
}
