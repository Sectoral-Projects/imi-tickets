import { container } from '@sapphire/framework';
import { eq } from 'drizzle-orm';
import { messageTemplates } from '@/database/sqlite/schema';
import type { APIMessageTopLevelComponent } from 'discord.js';
import Mustache from 'mustache';

// Discord TextDisplay content is markdown, not HTML — never HTML-escape template vars.
Mustache.escape = (value) => String(value);

export abstract class Component<TVars extends object = Record<string, never>> {
	public abstract readonly id: string;

	protected abstract readonly defaults: APIMessageTopLevelComponent[];

	public async render(...args: TVars extends Record<string, never> ? [] : [vars: TVars]): Promise<APIMessageTopLevelComponent[]> {
		const vars = (args[0] ?? {}) as TVars;
		const custom = this.getTemplate();

		const source = custom ? JSON.parse(custom) : this.defaults;

		return this.renderTemplate(source, vars);
	}

	public getSourceTemplate(): APIMessageTopLevelComponent[] {
		return structuredClone(this.defaults);
	}

	private renderTemplate(
		value: APIMessageTopLevelComponent[] | APIMessageTopLevelComponent | string | unknown,
		vars: TVars
	): APIMessageTopLevelComponent[] {
		if (typeof value === 'string') {
			// string alone is not valid root, wrap it
			return [
				{
					type: 10,
					content: Mustache.render(value, vars)
				} as APIMessageTopLevelComponent
			];
		}

		if (Array.isArray(value)) {
			return value.map((v) => this.renderTemplate(v, vars)).flat();
		}

		if (value && typeof value === 'object') {
			// recursively render object tree
			return [this.mapObject(value as any, vars)] as APIMessageTopLevelComponent[];
		}

		return [];
	}

	private mapObject(obj: any, vars: TVars): any {
		if (typeof obj === 'string') {
			return Mustache.render(obj, vars);
		}

		if (Array.isArray(obj)) {
			return obj.map((v) => this.mapObject(v, vars));
		}

		if (obj && typeof obj === 'object') {
			return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, this.mapObject(v, vars)]));
		}

		return obj;
	}

	private getTemplate(): string | null {
	try {
		const row = container.sqlite
			.select({
				template: messageTemplates.template,
				enabled: messageTemplates.enabled
			})
			.from(messageTemplates)
			.where(eq(messageTemplates.id, this.id))
			.limit(1)
			.get();

		return row?.enabled ? row.template : null;
	} catch {
		return null;
	}
}
}
