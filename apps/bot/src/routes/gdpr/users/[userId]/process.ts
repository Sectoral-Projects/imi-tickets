import { Protected } from '@/lib/api/guards';
import { Route } from '@/lib/api/route';
import {
	GDPR_ANONYMIZE_CONFIRMATION,
	GDPR_ERASE_CONFIRMATION,
	GDPR_ERASE_MODE,
	type GdprEraseMode
} from '@/lib/dataPrivacy/categories';
import { isDiscordUserId } from '@/lib/dataPrivacy/userReferences';
import { GdprService } from '@/services/gdpr';
import { Context, Hono } from 'hono';
import { BlankInput } from 'hono/types';
import type { ApiEnv } from '@/lib/api/context';

type ProcessBody = {
	mode?: string;
	confirmation?: string;
};

export default class GdprUserProcess extends Route {
	register(app: Hono<ApiEnv>, path: string) {
		app.post(path, (c) => this.processUser(c));
	}

	@Protected(['admin'])
	async processUser(c: Context<ApiEnv, string, BlankInput>) {
		const userId = c.req.param('userId')?.trim();
		if (!userId || !isDiscordUserId(userId)) {
			return c.json({ error: 'A valid Discord user ID is required' }, 400);
		}

		const body = await c.req.json<ProcessBody>().catch(() => null);
		const mode = parseEraseMode(body?.mode);
		if (!mode) {
			return c.json({ error: 'mode must be anonymize or erase' }, 400);
		}

		const expectedConfirmation =
			mode === GDPR_ERASE_MODE.Erase ? GDPR_ERASE_CONFIRMATION : GDPR_ANONYMIZE_CONFIRMATION;
		if (body?.confirmation?.trim() !== expectedConfirmation) {
			return c.json({ error: `Confirmation must be exactly "${expectedConfirmation}"` }, 400);
		}

		const result = GdprService.processUser(userId, mode, c.get('user')!.id);
		return c.json(result);
	}
}

function parseEraseMode(value: string | undefined): GdprEraseMode | null {
	if (value === GDPR_ERASE_MODE.Anonymize || value === GDPR_ERASE_MODE.Erase) return value;
	return null;
}
