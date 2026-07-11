import { messageTemplates } from '@/database/sqlite/schema';
import { findSystemComponent, getSystemTemplateView, listSystemTemplateViews, SYSTEM_COMPONENT_IDS } from '@/lib/components/registry';
import { RESERVED_BOT_COMMANDS } from '@/lib/discord/reservedCommands';
import { normalizeTemplateButtonActions, normalizeModalConfig } from '@/lib/buttonActions/normalize';
import type { ButtonActionConfig } from '@/lib/buttonActions/types';
import { mergeGlobalTemplateVariables, renderTimestamp, withPreviewTimestamp } from '@/lib/components/util/templateVariables';
import { container } from '@sapphire/framework';
import { desc, eq, like, sql } from 'drizzle-orm';
import type { APIMessageTopLevelComponent } from 'discord.js';
import Mustache from 'mustache';
import { AuditAction, AuditService } from './audit';
import { MODAL_TEMPLATE_CATEGORY, ModalTemplateService } from './modalTemplate';
import type { DbClient } from './types';

Mustache.escape = (value) => String(value);

export type MessageTemplateKind = 'system' | 'custom';

export interface ListMessageTemplatesInput {
	search?: string;
}

export interface SaveMessageTemplateInput {
	id: string;
	name: string;
	description?: string | null;
	template: unknown;
	category?: string | null;
	enabled?: boolean;
	staffCommand?: string | null;
}

export interface UpdateMessageTemplateInput {
	name?: string;
	description?: string | null;
	template?: unknown;
	category?: string | null;
	enabled?: boolean;
	buttonActions?: Record<string, ButtonActionConfig> | null;
	staffCommand?: string | null;
}

export interface MessageTemplateView {
	id: string;
	name: string;
	description: string | null;
	template: unknown;
	previewVariables?: Record<string, unknown>;
	category: string | null;
	templateType: 'message' | 'modal';
	enabled: boolean;
	version: number;
	updatedAt: string;
	kind: MessageTemplateKind;
	variables: string[];
	staffCommand: string | null;
	usesCodeDefault?: boolean;
	supportsButtonForward?: boolean;
	buttonActions?: Record<string, ButtonActionConfig>;
}

export abstract class MessageTemplateService {
	static list(input: ListMessageTemplatesInput = {}, db: DbClient = container.sqlite) {
		const rows = db
			.select()
			.from(messageTemplates)
			.where(input.search?.trim() ? like(messageTemplates.name, `%${input.search.trim()}%`) : undefined)
			.orderBy(desc(messageTemplates.updatedAt))
			.all();

		const rowViews = rows.map((row) => this.toView(row));
		const overrideIds = new Set(rows.map((row) => row.id));
		const systemDefaults = listSystemTemplateViews().filter((component) => !overrideIds.has(component.id));

		return [...systemDefaults, ...rowViews].sort((a, b) => a.id.localeCompare(b.id));
	}

	static get(id: string, db: DbClient = container.sqlite) {
		const row = db.select().from(messageTemplates).where(eq(messageTemplates.id, id)).limit(1).get();
		if (row) return this.toView(row);

		const system = getSystemTemplateView(id);
		if (!system) return null;

		return system;
	}

	static findByStaffCommand(command: string, db: DbClient = container.sqlite) {
		const normalized = tryNormalizeStaffCommand(command);
		if (!normalized) return null;

		const row = db
			.select()
			.from(messageTemplates)
			.where(sql`lower(${messageTemplates.staffCommand}) = ${normalized}`)
			.limit(1)
			.get();

		return row ? this.toView(row) : null;
	}

	static create(executedBy: string, input: SaveMessageTemplateInput, db: DbClient = container.sqlite) {
		const id = normalizeTemplateId(input.id);
		if (SYSTEM_COMPONENT_IDS.has(id)) throw new Error('Use update to override a system component template');

		const template = normalizeStoredTemplate(input.template, input.category);
		const now = new Date();
		const row = db
			.insert(messageTemplates)
			.values({
				id,
				name: normalizeName(input.name),
				description: normalizeNullableText(input.description),
				template: JSON.stringify(template),
				category: normalizeCategory(input.category),
				staffCommand: normalizeStaffCommand(input.staffCommand),
				enabled: input.enabled ?? true,
				version: 1,
				updatedAt: now
			})
			.returning()
			.get();

		AuditService.log({
			action: AuditAction.TemplateCreated,
			executedBy,
			payload: { id }
		});

		return this.toView(row);
	}

	static update(executedBy: string, id: string, input: UpdateMessageTemplateInput, db: DbClient = container.sqlite) {
		const normalizedId = normalizeTemplateId(id);
		const existing = db.select().from(messageTemplates).where(eq(messageTemplates.id, normalizedId)).limit(1).get();
		const system = findSystemComponent(normalizedId);

		if (!existing && !system) throw new Error('Template not found');

		const category = input.category ?? existing?.category ?? system?.category ?? 'custom';
		const template =
			input.template === undefined
				? existing
					? JSON.parse(existing.template)
					: awaitSystemTemplateValue(system)
				: normalizeStoredTemplate(input.template, category);

		const buttonActions =
			input.buttonActions === undefined
				? (existing?.buttonActions ?? undefined)
				: input.buttonActions === null
					? undefined
					: normalizeTemplateButtonActions(input.buttonActions);

		const staffCommand =
			input.staffCommand === undefined
				? (existing?.staffCommand ?? null)
				: normalizeStaffCommand(input.staffCommand);

		const now = new Date();
		const row = db
			.insert(messageTemplates)
			.values({
				id: normalizedId,
				name: normalizeName(input.name ?? existing?.name ?? system?.name ?? normalizedId),
				description: normalizeNullableText(input.description ?? existing?.description ?? system?.description ?? null),
				template: JSON.stringify(template),
				category: normalizeCategory(category),
				buttonActions,
				staffCommand,
				enabled: input.enabled ?? existing?.enabled ?? true,
				version: (existing?.version ?? 0) + 1,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: messageTemplates.id,
				set: {
					name: normalizeName(input.name ?? existing?.name ?? system?.name ?? normalizedId),
					description: normalizeNullableText(input.description ?? existing?.description ?? system?.description ?? null),
					template: JSON.stringify(template),
					category: normalizeCategory(category),
					buttonActions,
					staffCommand,
					enabled: input.enabled ?? existing?.enabled ?? true,
					version: (existing?.version ?? 0) + 1,
					updatedAt: now
				}
			})
			.returning()
			.get();

		AuditService.log({
			action: existing ? AuditAction.TemplateUpdated : AuditAction.TemplateCreated,
			executedBy,
			payload: { id: normalizedId }
		});

		return this.toView(row);
	}

	static delete(executedBy: string, id: string, db: DbClient = container.sqlite) {
		const normalizedId = normalizeTemplateId(id);
		const deleted = db
			.delete(messageTemplates)
			.where(eq(messageTemplates.id, normalizedId))
			.returning()
			.get();

		if (!deleted) return false;

		AuditService.log({
			action: AuditAction.TemplateDeleted,
			executedBy,
			payload: { id: normalizedId }
		});

		return true;
	}

	static preview(template: unknown, vars: Record<string, unknown> = {}) {
		const normalized = normalizeTemplate(template);
		return renderTemplate(normalized, vars);
	}

	static renderComponents(
		templateId: string,
		vars: Record<string, unknown> = {},
		db: DbClient = container.sqlite
	): APIMessageTopLevelComponent[] {
		const view = this.get(templateId, db);
		if (!view?.template) {
			throw new Error(`Template ${templateId} is not configured`);
		}

		const merged = { timestamp: renderTimestamp(), ...vars };
		const rendered = renderTemplate(normalizeTemplate(view.template), merged);
		if (Array.isArray(rendered)) {
			return rendered as APIMessageTopLevelComponent[];
		}

		return [rendered as APIMessageTopLevelComponent];
	}

	static listSystemComponents() {
		return listSystemTemplateViews().map((component) => ({
			id: component.id,
			name: component.name,
			description: component.description,
			category: component.category,
			variables: component.variables
		}));
	}

	private static toView(row: typeof messageTemplates.$inferSelect): MessageTemplateView {
		const system = findSystemComponent(row.id);
		const templateType = ModalTemplateService.isModalCategory(row.category) ? 'modal' : 'message';
		const customCommandVariables =
			templateType === 'message' && !system
				? ['staff', 'staffId', 'ticketId', 'ticketSubject']
				: [];
		return {
			id: row.id,
			name: row.name,
			description: row.description,
			template: JSON.parse(row.template),
			category: row.category,
			templateType,
			enabled: row.enabled,
			version: row.version,
			updatedAt: row.updatedAt.toISOString(),
			kind: system ? 'system' : 'custom',
			variables: mergeGlobalTemplateVariables([...(system?.variables ?? []), ...customCommandVariables]),
			staffCommand: row.staffCommand ?? null,
			previewVariables: withPreviewTimestamp(system?.sampleVariables ?? {}),
			usesCodeDefault: false,
			supportsButtonForward: system?.supportsButtonForward ?? true,
			buttonActions: row.buttonActions ?? undefined
		};
	}
}

function tryNormalizeStaffCommand(value: string | null | undefined) {
	if (value == null) return null;
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return null;
	if (!/^[a-z][a-z0-9_-]{0,31}$/.test(trimmed)) return null;
	if (RESERVED_BOT_COMMANDS.has(trimmed)) return null;
	if (container.stores.get('commands').some((command) => command.name === trimmed || command.aliases.includes(trimmed))) {
		return null;
	}
	return trimmed;
}

function normalizeStaffCommand(value: string | null | undefined) {
	if (value == null) return null;
	const normalized = tryNormalizeStaffCommand(value);
	if (!normalized) {
		const trimmed = value.trim().toLowerCase();
		if (!trimmed) return null;
		if (!/^[a-z][a-z0-9_-]{0,31}$/.test(trimmed)) {
			throw new Error('Staff command must be 1-32 characters and use letters, numbers, underscore, or dash');
		}
		if (RESERVED_BOT_COMMANDS.has(trimmed)) {
			throw new Error(`Staff command "${trimmed}" is reserved by a built-in bot command`);
		}
		if (container.stores.get('commands').some((command) => command.name === trimmed || command.aliases.includes(trimmed))) {
			throw new Error(`Staff command "${trimmed}" conflicts with a built-in bot command`);
		}
	}
	return normalized;
}

function normalizeTemplateId(id: string) {
	const trimmed = id.trim();
	if (!/^[a-z0-9][a-z0-9._:-]{1,63}$/i.test(trimmed)) {
		throw new Error('Template id must be 2-64 characters and use letters, numbers, dot, underscore, colon, or dash');
	}
	return trimmed;
}

function normalizeName(name: string) {
	const trimmed = name.trim();
	if (trimmed.length === 0) throw new Error('Template name is required');
	if (trimmed.length > 100) throw new Error('Template name must be 100 characters or less');
	return trimmed;
}

function normalizeNullableText(value: string | null | undefined) {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeCategory(value: string | null | undefined) {
	const trimmed = normalizeNullableText(value);
	if (!trimmed) return 'custom';
	if (trimmed === MODAL_TEMPLATE_CATEGORY) return MODAL_TEMPLATE_CATEGORY;
	return trimmed;
}

function normalizeStoredTemplate(value: unknown, category: string | null | undefined) {
	if (ModalTemplateService.isModalCategory(category)) {
		const normalized = normalizeModalConfig(value as import('@/lib/buttonActions/types').ModalConfig);
		if (!normalized) throw new Error('Modal template is invalid');
		return normalized;
	}

	return normalizeTemplate(value);
}

function normalizeTemplate(value: unknown) {
	const parsed = typeof value === 'string' ? parseTemplateString(value) : value;
	if (typeof parsed === 'string') return parsed;
	if (!Array.isArray(parsed) && !isPlainObject(parsed)) {
		throw new Error('Template must be a string, component object, or component array');
	}
	validateTemplateValue(parsed);
	return parsed;
}

function parseTemplateString(value: string) {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function validateTemplateValue(value: unknown) {
	if (Array.isArray(value)) {
		if (value.length === 0) throw new Error('Template component array cannot be empty');
		for (const item of value) validateTemplateValue(item);
		return;
	}

	if (!isPlainObject(value)) throw new Error('Template contains an invalid component');
	if (!('type' in value)) throw new Error('Each component object must include a type');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function renderTemplate(value: unknown, vars: Record<string, unknown>): unknown {
	if (typeof value === 'string') return Mustache.render(value, vars);
	if (Array.isArray(value)) return value.map((item) => renderTemplate(item, vars));
	if (isPlainObject(value)) {
		return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, renderTemplate(nested, vars)]));
	}
	return value;
}

function awaitSystemTemplateValue(system: ReturnType<typeof findSystemComponent>) {
	if (!system) return '# Template';
	return `# ${system.name}`;
}
