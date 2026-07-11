import type { APIEmoji, Emoji } from 'discord.js';

export type StoredReactionEmoji = {
	name: string;
	id: string | null;
	animated: boolean;
};

export function parseReactionEmoji(emoji: Emoji | APIEmoji): StoredReactionEmoji {
	const id = 'id' in emoji && emoji.id ? emoji.id : null;

	return {
		name: emoji.name ?? 'emoji',
		id,
		animated: 'animated' in emoji ? Boolean(emoji.animated) : false
	};
}

export function reactionEmojiKey(emoji: Pick<StoredReactionEmoji, 'name' | 'id'>) {
	if (emoji.id) return emoji.id;
	// Strip VS16 so 👍 and 👍️ share one transcript key.
	return emoji.name.replace(/\uFE0F/g, '');
}

export function reactionEmojiMatches(left: Emoji | APIEmoji, right: Emoji | APIEmoji | StoredReactionEmoji) {
	return reactionEmojiKey(parseReactionEmoji(left)) === reactionEmojiKey(parseReactionEmoji(right));
}
