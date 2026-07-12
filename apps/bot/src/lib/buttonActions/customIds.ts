export const TemplateButtonCustomIdPrefix = 'msg_btn:';
export const TemplateModalButtonCustomIdPrefix = 'msg_modal:';
export const ModalSubmitCustomIdPrefix = 'modal_submit:';
export const ModalRetryCustomIdPrefix = 'modal_retry:';

/** @deprecated Prefer buildEmbeddedMessageButtonCustomId for embedded buttons. */
export function buildMessageButtonCustomId(templateId: string) {
	return `${TemplateButtonCustomIdPrefix}${templateId}`;
}

export function buildEmbeddedMessageButtonCustomId(templateId: string, buttonId: string) {
	return `${TemplateButtonCustomIdPrefix}${templateId}:${buttonId}`;
}

/**
 * Parses embedded message button custom ids.
 * - New: `msg_btn:<parentTemplateId>:<buttonId>`
 * - Legacy: `msg_btn:<linkedTemplateId>` (no button config lookup)
 */
export function parseEmbeddedMessageButtonCustomId(customId: string) {
	if (!customId.startsWith(TemplateButtonCustomIdPrefix)) return null;
	const rest = customId.slice(TemplateButtonCustomIdPrefix.length).trim();
	if (!rest) return null;

	const separator = rest.indexOf(':');
	if (separator <= 0) {
		return { kind: 'legacy' as const, linkedTemplateId: rest };
	}

	const templateId = rest.slice(0, separator).trim();
	const buttonId = rest.slice(separator + 1).trim();
	if (!templateId || !buttonId) return null;

	return { kind: 'embedded' as const, templateId, buttonId };
}

export function buildEmbeddedModalButtonCustomId(templateId: string, buttonId: string) {
	return `${TemplateModalButtonCustomIdPrefix}${templateId}:${buttonId}`;
}

export function parseEmbeddedModalButtonCustomId(customId: string) {
	if (!customId.startsWith(TemplateModalButtonCustomIdPrefix)) return null;
	const rest = customId.slice(TemplateModalButtonCustomIdPrefix.length);
	const separator = rest.indexOf(':');
	if (separator <= 0) return null;

	const templateId = rest.slice(0, separator).trim();
	const buttonId = rest.slice(separator + 1).trim();
	if (!templateId || !buttonId) return null;

	return { templateId, buttonId };
}

export function buildDmOpenModalSubmitCustomId(buttonId: string) {
	return `${ModalSubmitCustomIdPrefix}dm:${buttonId}`;
}

export function buildChannelOpenModalSubmitCustomId(buttonId: string) {
	return `${ModalSubmitCustomIdPrefix}channel:${buttonId}`;
}

export function buildEmbeddedModalSubmitCustomId(templateId: string, buttonId: string) {
	return `${ModalSubmitCustomIdPrefix}tpl:${templateId}:${buttonId}`;
}

export function buildDmOpenModalRetryCustomId(buttonId: string) {
	return `${ModalRetryCustomIdPrefix}dm:${buttonId}`;
}

export function buildChannelOpenModalRetryCustomId(buttonId: string) {
	return `${ModalRetryCustomIdPrefix}channel:${buttonId}`;
}

export function buildEmbeddedModalRetryCustomId(templateId: string, buttonId: string) {
	return `${ModalRetryCustomIdPrefix}tpl:${templateId}:${buttonId}`;
}

export function parseModalSubmitCustomId(customId: string) {
	if (!customId.startsWith(ModalSubmitCustomIdPrefix)) return null;
	const rest = customId.slice(ModalSubmitCustomIdPrefix.length);

	if (rest.startsWith('dm:')) {
		const buttonId = rest.slice(3).trim();
		return buttonId ? { kind: 'dm' as const, buttonId } : null;
	}

	if (rest.startsWith('channel:')) {
		const buttonId = rest.slice(8).trim();
		return buttonId ? { kind: 'channel' as const, buttonId } : null;
	}

	if (rest.startsWith('tpl:')) {
		const payload = rest.slice(4);
		const separator = payload.indexOf(':');
		if (separator <= 0) return null;
		const templateId = payload.slice(0, separator).trim();
		const buttonId = payload.slice(separator + 1).trim();
		if (!templateId || !buttonId) return null;
		return { kind: 'embedded' as const, templateId, buttonId };
	}

	return null;
}

export function parseModalRetryCustomId(customId: string) {
	if (!customId.startsWith(ModalRetryCustomIdPrefix)) return null;
	return parseModalSubmitCustomId(`${ModalSubmitCustomIdPrefix}${customId.slice(ModalRetryCustomIdPrefix.length)}`);
}
