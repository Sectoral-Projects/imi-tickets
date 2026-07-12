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

export const ButtonMessageDelivery = {
	Presser: 'presser',
	PresserAndStaff: 'presser_and_staff',
	PresserAndParticipants: 'presser_and_participants',
	PresserStaffAndParticipants: 'presser_staff_and_participants'
} as const;

export type ButtonMessageDelivery =
	(typeof ButtonMessageDelivery)[keyof typeof ButtonMessageDelivery];

export const DEFAULT_BUTTON_MESSAGE_DELIVERY = ButtonMessageDelivery.PresserAndStaff;

export type ButtonActionConfig = {
	actionType: ButtonActionType;
	/** Linked component message template for message actions, or optional submit template after modal. */
	templateId?: string;
	/** Linked modal template for modal actions. */
	modalTemplateId?: string;
	/** Legacy inline modal config; prefer modalTemplateId. */
	modal?: ModalConfig;
	/** Where to fan out a linked message beyond the presser's interaction reply. */
	messageDelivery?: ButtonMessageDelivery;
	/** After the primary action (if any), close the open ticket like `/close`. */
	closeTicketOnPress?: boolean;
};

export type TemplateButtonActions = Record<string, ButtonActionConfig>;
