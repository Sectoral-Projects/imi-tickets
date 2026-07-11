import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import { rateLimiter, webSocketLimiter } from 'hono-rate-limiter';
import type { ApiEnv } from '@/lib/api/context';

/** Prefer authenticated user; otherwise client IP (proxy-aware). */
export function clientRateLimitKey(c: Context<ApiEnv>): string {
	const userId = c.get('user')?.id;
	if (userId) {
		return `user:${userId}`;
	}

	const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
	if (forwarded) {
		return `ip:${forwarded}`;
	}

	try {
		const address = getConnInfo(c).remote.address;
		if (address) {
			return `ip:${address}`;
		}
	} catch {
		// getConnInfo requires Node serve bindings; fall through
	}

	return 'ip:unknown';
}

function shouldSkipHttpRateLimit(c: Context<ApiEnv>): boolean {
	if (c.req.method === 'OPTIONS') {
		return true;
	}

	const path = c.req.path;
	return path === '/heartbeat' || path.endsWith('/heartbeat');
}

/** Global HTTP rate limit for REST / auth routes. */
export const httpRateLimiter = rateLimiter({
	windowMs: 60_000,
	limit: 200,
	standardHeaders: 'draft-7',
	keyGenerator: clientRateLimitKey,
	skip: shouldSkipHttpRateLimit
});

/**
 * Limits inbound WebSocket messages per client.
 * Realtime is mostly server→client; this still blocks message floods.
 */
export const wsMessageRateLimiter = webSocketLimiter({
	windowMs: 60_000,
	limit: 60,
	keyGenerator: clientRateLimitKey,
	message: 'Too many WebSocket messages, please slow down.',
	statusCode: 1008,
	skip: (event) => {
		const data = typeof event === 'object' && event !== null && 'data' in event ? event.data : null;
		return data === 'ping' || data === 'pong' || data === 'heartbeat';
	}
});
