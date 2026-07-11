import { DiscordAPIError, HTTPError, RateLimitError } from '@discordjs/rest';

export const CHANNEL_RENAME_RATE_LIMIT_MESSAGE =
	'Discord limits channel and forum post renames to 2 per 10 minutes. Wait a few minutes and try again.';

export function isChannelRenameRateLimited(error: unknown) {
	if (error instanceof RateLimitError) {
		return isChannelRenameRoute(error.method, error.route);
	}

	if (error instanceof DiscordAPIError) {
		if (error.status === 429) return true;
		if (error.code === 40062) return true;
	}

	if (error instanceof HTTPError && error.status === 429) {
		return true;
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return message.includes('rate limit') || message.includes('being rate limited');
	}

	return false;
}

export function formatChannelRenameError(error: unknown) {
	if (isChannelRenameRateLimited(error)) {
		return formatChannelRenameRateLimitMessage(error);
	}

	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}

	return 'Discord rejected the new channel name.';
}

export function formatChannelRenameRateLimitMessage(error?: unknown) {
	const retryHint = formatRetryAfterHint(error);
	return retryHint ? `${CHANNEL_RENAME_RATE_LIMIT_MESSAGE}${retryHint}` : CHANNEL_RENAME_RATE_LIMIT_MESSAGE;
}

export function shouldRejectChannelRenameRateLimit(rateLimitData: {
	method: string;
	route: string;
}) {
	return isChannelRenameRoute(rateLimitData.method, rateLimitData.route);
}

function isChannelRenameRoute(method: string, route: string) {
	return method === 'PATCH' && (route === '/channels/:id' || route.startsWith('/channels/'));
}

function formatRetryAfterHint(error: unknown) {
	if (!(error instanceof RateLimitError) || error.retryAfter <= 0) {
		return '';
	}

	const seconds = Math.ceil(error.retryAfter / 1000);
	if (seconds >= 60) {
		return ` You can retry in about ${Math.ceil(seconds / 60)} minute(s).`;
	}

	return ` You can retry in about ${seconds} second(s).`;
}
