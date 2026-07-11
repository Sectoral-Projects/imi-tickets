import { container } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { ANONYMOUS_STAFF_AUTHOR_LABEL } from '@/services/ticket';
import { SettingsService, type StaffRoleAlias } from '@/services/settings';
import type { DbClient } from '@/services/types';

export function formatStaffAuthorLabel(input: {
	anonymousStaff: boolean;
	roleAlias: string | null;
	displayName: string;
}) {
	if (input.roleAlias) {
		return input.anonymousStaff ? input.roleAlias : `${input.displayName} (${input.roleAlias})`;
	}

	return input.anonymousStaff ? ANONYMOUS_STAFF_AUTHOR_LABEL : input.displayName;
}

export async function resolveStaffRoleAlias(
	userId: string,
	aliases: StaffRoleAlias[] | undefined,
	primaryGuildId: string | null | undefined
) {
	if (!aliases?.length || !primaryGuildId) return null;

	const guild = await container.client.guilds.fetch(primaryGuildId).catch(() => null);
	if (!guild) return null;

	const member = await guild.members.fetch(userId).catch(() => null);
	if (!member) return null;

	const aliasByRoleId = new Map(aliases.map((entry) => [entry.roleId, entry.alias]));
	let best: { position: number; alias: string } | null = null;

	for (const role of member.roles.cache.values()) {
		const alias = aliasByRoleId.get(role.id);
		if (!alias) continue;

		if (!best || role.position > best.position) {
			best = { position: role.position, alias };
		}
	}

	return best?.alias ?? null;
}

export async function resolveStaffAuthorLabel(
	message: Message,
	db: DbClient = container.sqlite
) {
	const settings = SettingsService.getAppSettings(db);
	const config = SettingsService.get(db);
	const displayName = message.member?.displayName ?? message.author.tag;
	const roleAlias = await resolveStaffRoleAlias(
		message.author.id,
		settings.staffRoleAliases,
		config?.primaryGuildId ?? process.env.PRIMARY_GUILD_ID ?? null
	);

	return formatStaffAuthorLabel({
		anonymousStaff: Boolean(settings.anonymousStaff),
		roleAlias,
		displayName
	});
}
