import type { WebSocket } from 'ws';

export type RealtimeEvent =
	| { type: 'ticket.created'; ticketId: number }
	| { type: 'ticket.updated'; ticketId: number; status?: string; staffChannelName?: string }
	| { type: 'message.created'; ticketId: number; messageId: number }
	| { type: 'message.updated'; ticketId: number; messageId: number };

interface RealtimeClient {
	ws: WebSocket;
	userId: string;
}

export abstract class RealtimeService {
	private static clients = new Set<RealtimeClient>();

	static addClient(ws: WebSocket, userId: string) {
		this.clients.add({ ws, userId });
	}

	static removeClient(ws: WebSocket) {
		for (const client of this.clients) {
			if (client.ws === ws) {
				this.clients.delete(client);
				return;
			}
		}
	}

	static publish(event: RealtimeEvent) {
		const payload = JSON.stringify(event);

		for (const client of this.clients) {
			if (client.ws.readyState !== 1) {
				this.clients.delete(client);
				continue;
			}

			client.ws.send(payload);
		}
	}
}
