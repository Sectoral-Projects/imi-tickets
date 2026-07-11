import { container } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { MessageTemplateService } from '@/services/messageTemplate';
import { ModalTemplateService } from '@/services/modalTemplate';

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function parseStaffTemplateCommandName(message: Message) {
	if (!message.content || !message.inGuild()) return null;

	const prefix = await container.client.fetchPrefix(message);
	if (!prefix) return null;

	const prefixes = Array.isArray(prefix) ? prefix : [prefix];
	const matchedPrefix = prefixes.find((entry) => {
		const regex = new RegExp(`^${escapeRegExp(entry)}\\s*`, 'i');
		return regex.test(message.content);
	});

	if (!matchedPrefix) return null;

	const commandName = message.content.slice(matchedPrefix.length).trim().split(/\s+/)[0]?.toLowerCase();
	return commandName || null;
}

export async function parseStaffTemplateCommand(message: Message) {
	const commandName = await parseStaffTemplateCommandName(message);
	if (!commandName) return null;

	const template = MessageTemplateService.findByStaffCommand(commandName);
	if (!template || !template.enabled) return null;
	if (ModalTemplateService.isModalCategory(template.category)) return null;
	if (template.kind !== 'custom') return null;

	return template;
}
