import { Component } from './util/component';
import { buildLinkPreviewComponents } from './linkPreview';
import { APIMessageTopLevelComponent, Colors, ComponentType } from 'discord.js';
import { formatForwardedDiscordText, type RelayLinkPreview, type RelayMediaItem } from '../discord/relayContent';

export type MessageComponentVars = {
	author?: string;
	message: string;
	timestamp: string;
	media?: RelayMediaItem[];
	linkPreviews?: RelayLinkPreview[];
	forwarded?: boolean;
};

const FORWARDED_LABEL = '-# ↪ *Forwarded*';

export class MessageComponent extends Component<MessageComponentVars> {
	public readonly id = 'message';

	protected readonly defaults = [
		{
			type: ComponentType.Container,
			accent_color: Colors.Green,
			components: [
				{
					type: ComponentType.TextDisplay,
					content: '**{{author}}** • {{{timestamp}}}'
				},
				{
					type: ComponentType.TextDisplay,
					content: '{{message}}'
				}
			]
		}
	] satisfies APIMessageTopLevelComponent[];

	public override async render(vars: MessageComponentVars) {
		const displayMessage = vars.forwarded ? formatForwardedDiscordText(vars.message) : vars.message;
		const components = await super.render({
			author: vars.author ?? '',
			message: displayMessage.trim() || ' ',
			timestamp: vars.timestamp
		});

		const mainComponents = components.map((component) => {
			if (component.type !== ComponentType.Container || !('components' in component)) {
				return component;
			}

			let nextComponents = component.components;

			if (!vars.author?.trim()) {
				nextComponents = nextComponents.slice(1);
			}

			if (vars.forwarded) {
				const authorOffset = vars.author?.trim() ? 1 : 0;
				nextComponents = [
					...nextComponents.slice(0, authorOffset),
					{
						type: ComponentType.TextDisplay,
						content: FORWARDED_LABEL
					},
					...nextComponents.slice(authorOffset)
				];
			}

			if (!vars.message.trim()) {
				nextComponents = nextComponents.filter(
					(entry) => entry.type !== ComponentType.TextDisplay || !('content' in entry) || entry.content.trim() !== ''
				);
			}

			if (vars.media?.length) {
				nextComponents = [
					...nextComponents,
					{
						type: ComponentType.MediaGallery,
						items: vars.media.slice(0, 10).map((item) => ({
							media: { url: item.url },
							description: item.description ?? undefined,
							spoiler: item.spoiler ?? false
						}))
					}
				];
			}

			const linkPreviewComponents = buildLinkPreviewComponents(vars.linkPreviews ?? []);
			if (linkPreviewComponents.length > 0) {
				const timestampComponent = nextComponents.at(-1);
				nextComponents = [...nextComponents.slice(0, -1), ...linkPreviewComponents, ...(timestampComponent ? [timestampComponent] : [])];
			}

			return {
				...component,
				components: nextComponents
			};
		});

		return mainComponents;
	}
}

export const Message = new MessageComponent();
