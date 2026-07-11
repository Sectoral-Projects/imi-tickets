import { container } from '@sapphire/framework';
import type { Message } from 'discord.js';

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns true when the message matches a registered Sapphire prefix command. */
export async function isMessageCommand(message: Message) {
	if (!message.content) return false;

	const prefix = await container.client.fetchPrefix(message);
	if (!prefix) return false;

	const prefixes = Array.isArray(prefix) ? prefix : [prefix];
	const matchedPrefix = prefixes.find((entry) => {
		const regex = new RegExp(`^${escapeRegExp(entry)}\\s*`, 'i');
		return regex.test(message.content);
	});

	if (!matchedPrefix) return false;

	const commandName = message.content.slice(matchedPrefix.length).trim().split(/\s+/)[0]?.toLowerCase();
	if (!commandName) return false;

	return container.stores.get('commands').some((command) => {
		return command.name === commandName || command.aliases.includes(commandName);
	});
}
