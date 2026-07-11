import { Blocked } from '@/lib/components/blocked';
import {
	Message,
	MessageFlags,
	type ButtonInteraction,
	type ModalSubmitInteraction
} from 'discord.js';

export async function replyBlocked(target: Message, reason?: string | null): Promise<void>;
export async function replyBlocked(
	target: ButtonInteraction | ModalSubmitInteraction,
	reason?: string | null
): Promise<void>;
export async function replyBlocked(
	target: Message | ButtonInteraction | ModalSubmitInteraction,
	reason?: string | null
) {
	const components = await Blocked.render({ reason: reason ?? undefined });

	if (target instanceof Message) {
		await target.reply({
			components,
			flags: MessageFlags.IsComponentsV2
		});
		return;
	}

	await target.reply({
		components,
		flags: MessageFlags.IsComponentsV2,
		ephemeral: target.inGuild()
	});
}
