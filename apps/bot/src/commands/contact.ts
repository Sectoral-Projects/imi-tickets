import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import {
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	InteractionContextType,
	Message,
	User
} from 'discord.js';
import { requireGuildPermission, replyComponents, textComponent } from '@/lib/discord/staffCommand';
import { STAFF_CONTACT_NOTICE } from '@/lib/components/staffContact';
import { TicketOpenService } from '@/services/ticketOpen';
import { TicketService } from '@/services/ticket';

function parsePrivacyFlag(raw: string | null | undefined) {
	if (!raw) return false;
	const normalized = raw.trim().toLowerCase();
	return normalized === 'true' || normalized === 'yes' || normalized === 'on' || normalized === '1';
}

function parseContactMessageArgs(message: Message, rest: string) {
	const users = [...message.mentions.users.values()];
	const privacyMatch = rest.match(/\bprivacy\s*[:=]\s*(true|false|yes|no|on|off|1|0)\b/i);
	const hideMemberIdentities = privacyMatch ? parsePrivacyFlag(privacyMatch[1]) : false;
	return { users, hideMemberIdentities };
}

@ApplyOptions<Command.Options>({
	description: 'Create a shared ticket with one or more members.'
})
export class ContactCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		const integrationTypes: ApplicationIntegrationType[] = [
			ApplicationIntegrationType.GuildInstall,
			ApplicationIntegrationType.UserInstall
		];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'user',
					description: 'The first member to contact.',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'user2',
					description: 'An additional member for a shared ticket.',
					type: ApplicationCommandOptionType.User,
					required: false
				},
				{
					name: 'user3',
					description: 'An additional member for a shared ticket.',
					type: ApplicationCommandOptionType.User,
					required: false
				},
				{
					name: 'privacy',
					description: 'Hide member usernames from each other in DM relays.',
					type: ApplicationCommandOptionType.Boolean,
					required: false
				}
			],
			integrationTypes,
			contexts
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!(await requireGuildPermission(interaction))) {
			return this.replyLines(interaction, 'Contact', ['You do not have permission to create tickets.']);
		}

		const users = [
			interaction.options.getUser('user', true),
			interaction.options.getUser('user2'),
			interaction.options.getUser('user3')
		].filter((user): user is User => user !== null);

		const hideMemberIdentities = interaction.options.getBoolean('privacy') ?? false;
		return this.contactUsers(interaction, users, interaction.user.id, hideMemberIdentities);
	}

	public override async messageRun(message: Message, args: Args) {
		if (!(await requireGuildPermission(message))) {
			return this.replyLines(message, 'Contact', ['You do not have permission to create tickets.']);
		}

		const rest = await args.rest('string').catch(() => '');
		const { users, hideMemberIdentities } = parseContactMessageArgs(message, rest);
		if (users.length === 0) {
			return this.replyLines(message, 'Contact', ['Mention at least one member to contact.']);
		}

		return this.contactUsers(message, users, message.author.id, hideMemberIdentities);
	}

	private async replyLines(target: Message | Command.ChatInputCommandInteraction, title: string, lines: string[]) {
		return replyComponents(target, textComponent(title, lines));
	}

	private async contactUsers(
		target: Message | Command.ChatInputCommandInteraction,
		users: User[],
		executedBy: string,
		hideMemberIdentities: boolean
	) {
		const uniqueUsers = [...new Map(users.map((user) => [user.id, user])).values()];
		const blockedUsers = uniqueUsers.filter((user) => TicketService.findOpenThreadForUser(user.id));
		if (blockedUsers.length === uniqueUsers.length) {
			return this.replyLines(
				target,
				'Contact',
				blockedUsers.map((user) => `• ${user.tag}: already has ticket #${TicketService.findOpenThreadForUser(user.id)!.id}`)
			);
		}

		const eligibleUsers = uniqueUsers.filter((user) => !TicketService.findOpenThreadForUser(user.id));
		const skipped = uniqueUsers
			.filter((user) => TicketService.findOpenThreadForUser(user.id))
			.map((user) => `• ${user.tag}: already has ticket #${TicketService.findOpenThreadForUser(user.id)!.id}`);

		try {
			if (eligibleUsers.length === 1) {
				const user = eligibleUsers[0]!;
				const dm = await user.createDM().catch(() => null);
				if (!dm) {
					return this.replyLines(target, 'Contact', [`• ${user.tag}: could not open DM`]);
				}

				const { thread } = await TicketOpenService.openFromContent({
					user,
					dmChannelId: dm.id,
					messageId: `contact:${user.id}:${Date.now()}`,
					content: STAFF_CONTACT_NOTICE,
					executedBy,
					subject: 'Staff contact',
					hideMemberIdentities,
					staffContactOpening: true
				});
				await TicketOpenService.sendStaffContactDm(thread.id, dm.id, executedBy);
				skipped.push(`• Ticket #${thread.id} created for ${user.tag}`);
			} else {
				const { thread } = await TicketOpenService.openGroupContact({
					users: eligibleUsers,
					executedBy,
					hideMemberIdentities
				});

				for (const [index, user] of eligibleUsers.entries()) {
					const dm = await user.createDM().catch(() => null);
					if (!dm) {
						skipped.push(`• ${user.tag}: could not open DM`);
						continue;
					}
					await TicketOpenService.sendStaffContactDm(thread.id, dm.id, executedBy, {
						recordTranscript: index === 0
					});
				}

				skipped.unshift(`• Shared ticket #${thread.id} created for ${eligibleUsers.map((user) => user.tag).join(', ')}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create contact ticket.';
			return this.replyLines(target, 'Contact', [message]);
		}

		const response = skipped.join('\n').trim();
		if (!response) return;

		return this.replyLines(target, 'Contact', response.split('\n'));
	}
}
