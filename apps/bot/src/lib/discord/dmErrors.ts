import { DiscordAPIError } from '@discordjs/rest';
import { container } from '@sapphire/framework';

/** Discord: cannot DM this user (blocked, DMs closed, or no mutual guilds). */
export const DISCORD_CANNOT_DM_USER = 50007;
/** Discord: cannot DM due to having no mutual guilds. */
export const DISCORD_NO_MUTUAL_GUILDS = 50278;

export function isUnreachableDmError(error: unknown): boolean {
	if (!(error instanceof DiscordAPIError)) return false;
	return error.code === DISCORD_CANNOT_DM_USER || error.code === DISCORD_NO_MUTUAL_GUILDS;
}

/** Logs unexpected DM send failures. Unreachable DMs (closed / no mutual guilds) are silent — handled via audit markers + staff notices. */
export function logDmSendFailure(context: string, error: unknown) {
	if (isUnreachableDmError(error)) return;

	container.logger.warn(context, error);
}
