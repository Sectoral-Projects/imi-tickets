import {
	ButtonStyle,
	ComponentType,
	type APIComponentInContainer
} from 'discord.js';
import type { RelayLinkPreview } from '../discord/linkPreview';
import { resolveLinkPreviewMediaUrl } from '../discord/linkPreview';

export function buildLinkPreviewComponents(previews: RelayLinkPreview[]): APIComponentInContainer[] {
	const components: APIComponentInContainer[] = [];

	for (const preview of previews) {
		components.push(...buildSingleLinkPreviewComponents(preview));
	}

	return components;
}

function buildSingleLinkPreviewComponents(preview: RelayLinkPreview): APIComponentInContainer[] {
	const components: APIComponentInContainer[] = [];
	const textDisplay = buildPreviewTextDisplay(preview);
	const mediaUrl = resolveLinkPreviewMediaUrl(preview);

	if (textDisplay || mediaUrl) {
		components.push({
			type: ComponentType.Separator,
			divider: true
		});
	}

	if (textDisplay) {
		components.push(textDisplay);
	}

	if (mediaUrl) {
		components.push({
			type: ComponentType.MediaGallery,
			items: [
				{
					media: { url: mediaUrl },
					description: preview.title ?? undefined
				}
			]
		});
	}

	components.push({
		type: ComponentType.ActionRow,
		components: [
			{
				type: ComponentType.Button,
				style: ButtonStyle.Link,
				label: preview.provider ? `Open on ${preview.provider}` : 'Open link',
				url: preview.url
			}
		]
	});

	return components;
}

function buildPreviewTextDisplay(preview: RelayLinkPreview): APIComponentInContainer | null {
	const lines: string[] = [];

	if (preview.provider) {
		lines.push(`-# ${preview.provider}`);
	}

	if (preview.author) {
		lines.push(`**${preview.author}**`);
	}

	const title = preview.title?.trim();
	if (title) {
		lines.push(`[${title}](${preview.url})`);
	}

	if (lines.length === 0) return null;

	return {
		type: ComponentType.TextDisplay as const,
		content: lines.join('\n')
	};
}
