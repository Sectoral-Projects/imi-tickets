import { z } from "zod";
import type { ButtonActionType } from "./button-actions";
import { buttonActionConfigSchema, modalConfigSchema } from "./button-actions";

export const messageTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  template: z.unknown().nullable(),
  previewVariables: z.record(z.string(), z.unknown()).optional(),
  category: z.string().nullable(),
  templateType: z.enum(["message", "modal"]).optional(),
  enabled: z.boolean(),
  version: z.number(),
  updatedAt: z.string(),
  kind: z.enum(["system", "custom"]),
  variables: z.array(z.string()),
  staffCommand: z.string().nullable().optional(),
  usesCodeDefault: z.boolean().optional(),
  supportsButtonForward: z.boolean().optional(),
  buttonActions: z.record(z.string(), buttonActionConfigSchema).optional(),
});

export type MessageTemplate = z.infer<typeof messageTemplateSchema>;

export const dmOpenButtonSchema = z.object({
  id: z.string(),
  label: z.string(),
  templateId: z.string(),
  actionType: z.enum(["message", "modal"]).optional(),
  modalTemplateId: z.string().optional(),
  modal: modalConfigSchema.optional(),
  optionalTag: z.string().nullable(),
  sortOrder: z.number(),
  enabled: z.boolean(),
  updatedAt: z.string(),
});

export type DmOpenButton = z.infer<typeof dmOpenButtonSchema>;

export type DmOpenButtonDraft = {
  id: string;
  label: string;
  actionType: ButtonActionType;
  templateId: string;
  modalTemplateId?: string;
  optionalTag: string;
  enabled: boolean;
};

export const channelOpenButtonSchema = z.object({
  id: z.string(),
  label: z.string(),
  templateId: z.string(),
  actionType: z.enum(["message", "modal", "open_only"]).optional(),
  modalTemplateId: z.string().optional(),
  modal: modalConfigSchema.optional(),
  optionalTag: z.string().nullable(),
  subjectTemplate: z.string().nullable(),
  sortOrder: z.number(),
  enabled: z.boolean(),
  updatedAt: z.string(),
});

export type ChannelOpenButton = z.infer<typeof channelOpenButtonSchema>;

export type ChannelOpenButtonDraft = {
  id: string;
  label: string;
  actionType: ButtonActionType | "open_only";
  templateId: string;
  modalTemplateId?: string;
  optionalTag: string;
  subjectTemplate: string;
  enabled: boolean;
};
