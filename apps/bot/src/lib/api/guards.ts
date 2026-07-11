import { RbacPermission, RbacService, type RbacPermissionType } from '@/services/rbac';
import { SetupService } from '@/services/setup';
import type { Context } from 'hono';
import type { ApiEnv } from './context';

export type ProtectedPermission = 'read' | 'manage' | 'admin' | RbacPermissionType;
type ProtectedRouteHandler = (this: unknown, c: Context<ApiEnv>, ...args: unknown[]) => unknown | Promise<unknown>;

export async function requireProductPermission(c: Context<ApiEnv>, permission: RbacPermissionType = RbacPermission.Read) {
	const result = await RbacService.authorizeProductAccess(c.get('user')?.id ?? null, permission);

	if (result.allowed) return null;

	if (result.reason === 'unauthenticated') {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	if (result.reason === 'onboarding_required') {
		return c.json({ error: 'Onboarding required', code: 'ONBOARDING_REQUIRED' }, 403);
	}

	return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
}

export function requireSession(c: Context<ApiEnv>) {
	if (c.get('user')) return null;

	return c.json({ error: 'Unauthorized' }, 401);
}

export async function requireSetupOwner(c: Context<ApiEnv>) {
	const denied = requireSession(c);
	if (denied) return denied;

	const userId = c.get('user')!.id;
	const status = SetupService.getStatus(userId);

	if (status.complete) {
		return requireProductPermission(c, RbacPermission.Manage);
	}

	if (!SetupService.canMutateSetup(userId)) {
		return c.json({ error: 'Setup owner required', code: 'SETUP_OWNER_REQUIRED' }, 403);
	}

	return null;
}

export function Protected(permissions: ProtectedPermission[] = ['read']): MethodDecorator {
	return (_target, _propertyKey, descriptor) => {
		const routeDescriptor = descriptor as unknown as TypedPropertyDescriptor<ProtectedRouteHandler>;
		const handler = routeDescriptor.value;
		if (!handler) {
			throw new Error('@Protected can only be used on route handler methods');
		}

		routeDescriptor.value = async function protectedRoute(this: unknown, c: Context<ApiEnv>, ...args: unknown[]) {
			for (const permission of permissions) {
				const denied = await requireProductPermission(c, normalizePermission(permission));
				if (denied) return denied;
			}

			return handler.call(this, c, ...args);
		};
	};
}

function normalizePermission(permission: ProtectedPermission): RbacPermissionType {
	switch (permission) {
		case 'read':
		case RbacPermission.Read:
			return RbacPermission.Read;
		case 'manage':
		case RbacPermission.Manage:
			return RbacPermission.Manage;
		case 'admin':
		case RbacPermission.Admin:
			return RbacPermission.Admin;
	}
}
