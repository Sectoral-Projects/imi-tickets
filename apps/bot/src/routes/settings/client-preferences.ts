import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import { RbacPermission, RbacService } from '@/services/rbac';
import { SettingsService } from '@/services/settings';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

/** READ-safe display preferences + capability flags for the staff UI shell. */
export default class SettingsClientPreferences extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.get(path, (c) => this.getClientPreferences(c));
	}

	@Protected()
	async getClientPreferences(c: Context<ApiEnv, string, BlankInput>) {
		const userId = c.get('user')?.id ?? null;
		const settings = SettingsService.getAppSettings();
		const manageAccess = userId
			? await RbacService.authorizeProductAccess(userId, RbacPermission.Manage)
			: { allowed: false };
		const adminAccess = userId
			? await RbacService.authorizeProductAccess(userId, RbacPermission.Admin)
			: { allowed: false };

		return c.json({
			useChannelNameForTranscript: Boolean(settings.useChannelNameForTranscript),
			canManage: manageAccess.allowed,
			canAdmin: adminAccess.allowed
		});
	}
}
