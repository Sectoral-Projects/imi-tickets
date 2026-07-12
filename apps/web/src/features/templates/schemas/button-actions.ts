import { z } from "zod";

export const buttonActionTypeSchema = z.enum(["message", "modal"]);

export const modalFieldTypeSchema = z.enum([
  "text",
  "paragraph",
  "string_select",
  "radio",
  "checkbox",
  "role_select",
]);

export const modalFieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
  default: z.boolean().optional(),
});

export const modalFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: modalFieldTypeSchema,
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  minValues: z.number().optional(),
  maxValues: z.number().optional(),
  options: z.array(modalFieldOptionSchema).optional(),
  wordFilter: z
    .object({
      mode: z.enum(["blacklist", "whitelist"]),
      match: z.enum(["keyword", "exact"]),
      terms: z.array(z.string().min(1).max(100)).min(1).max(100),
    })
    .optional(),
});

export const modalConfigSchema = z.object({
  title: z.string(),
  fields: z.array(modalFieldSchema),
});

export const buttonMessageDeliverySchema = z.enum([
  "presser",
  "presser_and_staff",
  "presser_and_participants",
  "presser_staff_and_participants",
]);

export const DEFAULT_BUTTON_MESSAGE_DELIVERY = "presser_and_staff" as const;

export const buttonActionConfigSchema = z.object({
  actionType: buttonActionTypeSchema,
  templateId: z.string().optional(),
  modalTemplateId: z.string().optional(),
  modal: modalConfigSchema.optional(),
  messageDelivery: buttonMessageDeliverySchema.optional(),
  closeTicketOnPress: z.boolean().optional(),
});

export type ButtonActionType = z.infer<typeof buttonActionTypeSchema>;
export type ButtonMessageDelivery = z.infer<typeof buttonMessageDeliverySchema>;
export type ModalFieldType = z.infer<typeof modalFieldTypeSchema>;
export type ModalFieldOption = z.infer<typeof modalFieldOptionSchema>;
export type ModalFieldConfig = z.infer<typeof modalFieldSchema>;
export type ModalConfig = z.infer<typeof modalConfigSchema>;
export type ButtonActionConfig = z.infer<typeof buttonActionConfigSchema>;
export type TemplateButtonActions = Record<string, ButtonActionConfig>;
