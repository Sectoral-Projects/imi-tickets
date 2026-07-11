const pendingDmChannelIds = new Set<string>();

export abstract class OutboundDmGuard {
	static mark(channelId: string) {
		pendingDmChannelIds.add(channelId);
	}

	static unmark(channelId: string) {
		pendingDmChannelIds.delete(channelId);
	}

	static isPending(channelId: string) {
		return pendingDmChannelIds.has(channelId);
	}
}
