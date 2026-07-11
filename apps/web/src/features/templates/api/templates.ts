import { api } from "@/lib/api";
import type { ButtonActionConfig } from "../schemas/button-actions";
import type {
  ChannelOpenButtonDraft,
  ChannelOpenButton,
  DmOpenButtonDraft,
  DmOpenButton,
  MessageTemplate,
} from "../schemas/templates";

export function fetchTemplates() {
  return api.get<{ templates: MessageTemplate[] }>("/templates");
}

export function createTemplate(input: {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  template: unknown;
  enabled?: boolean;
}) {
  return api.post<MessageTemplate>("/templates", input);
}

export function updateTemplate(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    category?: string | null;
  template?: unknown;
  enabled?: boolean;
  staffCommand?: string | null;
  buttonActions?: Record<string, ButtonActionConfig> | null;
  },
) {
  return api.patch<MessageTemplate>(`/templates/${encodeURIComponent(id)}`, input);
}

export function deleteTemplate(id: string) {
  return api.delete<{ deleted: boolean }>(`/templates/${encodeURIComponent(id)}`);
}

export function previewTemplate(id: string, template: unknown, vars: Record<string, unknown>) {
  return api.post<{ components: unknown }>(
    `/templates/${encodeURIComponent(id)}/preview`,
    { template, vars },
  );
}

export function fetchDmOpenButtons() {
  return api.get<{ buttons: DmOpenButton[] }>("/settings/dm-buttons");
}

export function replaceDmOpenButtons(buttons: DmOpenButtonDraft[]) {
  return api.put<{ buttons: DmOpenButton[] }>("/settings/dm-buttons", {
    buttons: buttons.map((button, index) => ({
      ...button,
      optionalTag: button.optionalTag.trim() || null,
      sortOrder: index,
    })),
  });
}

export function fetchChannelOpenButtons() {
  return api.get<{ buttons: ChannelOpenButton[] }>("/settings/channel-open-buttons");
}

export function replaceChannelOpenButtons(buttons: ChannelOpenButtonDraft[]) {
  return api.put<{ buttons: ChannelOpenButton[] }>("/settings/channel-open-buttons", {
    buttons: buttons.map((button, index) => ({
      ...button,
      optionalTag: button.optionalTag.trim() || null,
      subjectTemplate: button.subjectTemplate.trim() || null,
      sortOrder: index,
    })),
  });
}
