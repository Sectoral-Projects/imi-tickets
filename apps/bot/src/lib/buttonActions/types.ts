export const ButtonActionType = {
	Message: 'message',
	Modal: 'modal',
	OpenOnly: 'open_only'
} as const;

export type ButtonActionType = (typeof ButtonActionType)[keyof typeof ButtonActionType];

export const ModalFieldType = {
	Text: 'text',
	Paragraph: 'paragraph',
	StringSelect: 'string_select',
	Radio: 'radio',
	Checkbox: 'checkbox',
	RoleSelect: 'role_select'
} as const;

export type ModalFieldType = (typeof ModalFieldType)[keyof typeof ModalFieldType];

export type ModalFieldOption = {
	label: string;
	value: string;
	description?: string;
	default?: boolean;
};

export type ModalFieldConfig = {
	id: string;
	label: string;
	type: ModalFieldType;
	required?: boolean;
	placeholder?: string;
	minLength?: number;
	maxLength?: number;
	minValues?: number;
	maxValues?: number;
	options?: ModalFieldOption[];
	wordFilter?: {
		mode: 'blacklist' | 'whitelist';
		match: 'keyword' | 'exact';
		terms: string[];
	};
};

export type ModalConfig = {
	title: string;
	fields: ModalFieldConfig[];
};

export type ButtonActionConfig = {
	actionType: ButtonActionType;
	/** Linked component message template for message actions, or optional submit template after modal. */
	templateId?: string;
	/** Linked modal template for modal actions. */
	modalTemplateId?: string;
	/** Legacy inline modal config; prefer modalTemplateId. */
	modal?: ModalConfig;
};

export type TemplateButtonActions = Record<string, ButtonActionConfig>;
