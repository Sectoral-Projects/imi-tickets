export const DataCategory = {
	Tickets: 'tickets',
	MemberSnapshots: 'member_snapshots',
	AuditLog: 'audit_log',
	BlockedEntities: 'blocked_entities',
	PendingTicketOpens: 'pending_ticket_opens'
} as const;

export type DataCategoryType = (typeof DataCategory)[keyof typeof DataCategory];

export const DATA_CATEGORY_ORDER: DataCategoryType[] = [
	DataCategory.Tickets,
	DataCategory.MemberSnapshots,
	DataCategory.AuditLog,
	DataCategory.BlockedEntities,
	DataCategory.PendingTicketOpens
];

/** Selecting a category auto-selects its dependencies. */
export const DATA_CATEGORY_DEPENDENCIES: Record<DataCategoryType, DataCategoryType[]> = {
	[DataCategory.Tickets]: [],
	[DataCategory.MemberSnapshots]: [],
	[DataCategory.AuditLog]: [],
	[DataCategory.BlockedEntities]: [],
	[DataCategory.PendingTicketOpens]: []
};

export const DATA_CATEGORY_LABELS: Record<DataCategoryType, string> = {
	[DataCategory.Tickets]:
		'Tickets and conversations (threads, messages, notes, attachments, participants, tags, status history)',
	[DataCategory.MemberSnapshots]: 'Member identity snapshots',
	[DataCategory.AuditLog]: 'Audit log',
	[DataCategory.BlockedEntities]: 'Blocked users and roles',
	[DataCategory.PendingTicketOpens]: 'Pending ticket open requests'
};

export function expandDataCategories(categories: DataCategoryType[]) {
	const selected = new Set<DataCategoryType>();
	const queue = [...categories];

	while (queue.length > 0) {
		const category = queue.pop()!;
		if (selected.has(category)) continue;
		selected.add(category);
		for (const dependency of DATA_CATEGORY_DEPENDENCIES[category]) {
			if (!selected.has(dependency)) queue.push(dependency);
		}
	}

	return DATA_CATEGORY_ORDER.filter((category) => selected.has(category));
}

export function isDataCategory(value: string): value is DataCategoryType {
	return (Object.values(DataCategory) as string[]).includes(value);
}

export const GDPR_ERASE_MODE = {
	Anonymize: 'anonymize',
	Erase: 'erase'
} as const;

export type GdprEraseMode = (typeof GDPR_ERASE_MODE)[keyof typeof GDPR_ERASE_MODE];

export const DANGEROUS_DELETE_CONFIRMATION = 'DELETE DATA';
export const GDPR_ANONYMIZE_CONFIRMATION = 'ANONYMIZE USER';
export const GDPR_ERASE_CONFIRMATION = 'ERASE USER';
