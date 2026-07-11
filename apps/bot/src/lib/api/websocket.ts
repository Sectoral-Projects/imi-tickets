import { upgradeWebSocket } from '@hono/node-server';
import type { Hono } from 'hono';
import type { ApiEnv } from '@/lib/api/context';
import { RbacPermission, RbacService } from '@/services/rbac';
import { RealtimeService } from '@/services/realtime';
import type { WebSocket } from 'ws';

export function registerWebSocketRoutes(app: Hono<ApiEnv>) {
	app.get(
		'/ws',
		upgradeWebSocket(async (c) => {
			const user = c.get('user');
			if (!user) {
				return {
					onOpen(_event, ws) {
						ws.close(4401, 'Unauthorized');
					}
				};
			}

			const access = await RbacService.authorizeProductAccess(user.id, RbacPermission.Read);
			if (!access.allowed) {
				return {
					onOpen(_event, ws) {
						ws.close(4403, 'Forbidden');
					}
				};
			}

			return {
				onOpen(_event, ws) {
					RealtimeService.addClient(ws.raw as WebSocket, user.id);
				},
				onClose(_event, ws) {
					RealtimeService.removeClient(ws.raw as WebSocket);
				}
			};
		})
	);
}
