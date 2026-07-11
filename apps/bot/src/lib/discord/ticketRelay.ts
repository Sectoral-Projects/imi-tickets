import { RbacPermission, RbacService } from '@/services/rbac';

/** Allow staff (including the ticket opener when they have staff access) to relay from ticket channels. */
export async function shouldRelayStaffTicketActivity(
	authorId: string,
	threadUserId: string,
	guildId: string | null | undefined
) {
	if (authorId !== threadUserId) return true;
	if (!guildId) return false;

	return RbacService.hasGuildPermission(authorId, guildId, RbacPermission.Read);
}
