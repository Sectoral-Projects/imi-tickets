import type { ChannelOpenButtonDraft, MessageTemplate, DmOpenButtonDraft } from "../schemas/templates";
import type { ButtonActionConfig } from "../schemas/button-actions";
import { MODAL_TEMPLATE_CATEGORY } from "../constants";
import type { ModalConfig } from "../schemas/button-actions";

export function isModalTemplate(template: Pick<MessageTemplate, "category" | "templateType">) {
  return template.templateType === "modal" || template.category === MODAL_TEMPLATE_CATEGORY;
}

export function isMessageTemplate(template: Pick<MessageTemplate, "category" | "templateType">) {
  return !isModalTemplate(template);
}

export function filterMessageTemplates(templates: MessageTemplate[]) {
  return templates.filter(isMessageTemplate);
}

export function filterModalTemplates(templates: MessageTemplate[]) {
  return templates.filter(isModalTemplate);
}

export function getModalFieldIds(modalTemplate: MessageTemplate | null | undefined) {
  if (!modalTemplate || !isModalTemplate(modalTemplate)) return [];
  const config = modalTemplate.template as ModalConfig | null;
  if (!config || !Array.isArray(config.fields)) return [];
  return config.fields
    .map((field) => field.id.trim())
    .filter((id) => id.length > 0);
}

export function collectInboundModalVariables(
  targetTemplateId: string,
  templates: MessageTemplate[],
  dmButtons: DmOpenButtonDraft[] = [],
  channelButtons: ChannelOpenButtonDraft[] = [],
) {
  const vars = new Set<string>();
  const modalTemplateIds = new Set<string>();

  const trackModalAction = (action: ButtonActionConfig | undefined) => {
    if (action?.actionType !== "modal") return;
    if (action.templateId?.trim() !== targetTemplateId) return;
    const modalId = action.modalTemplateId?.trim();
    if (modalId) modalTemplateIds.add(modalId);
  };

  for (const button of dmButtons) {
    if (button.actionType !== "modal") continue;
    if (button.templateId.trim() !== targetTemplateId) continue;
    const modalId = button.modalTemplateId?.trim();
    if (modalId) modalTemplateIds.add(modalId);
  }

  for (const button of channelButtons) {
    if (button.actionType !== "modal") continue;
    if (button.templateId.trim() !== targetTemplateId) continue;
    const modalId = button.modalTemplateId?.trim();
    if (modalId) modalTemplateIds.add(modalId);
  }

  for (const template of templates) {
    for (const action of Object.values(template.buttonActions ?? {})) {
      trackModalAction(action);
    }
  }

  for (const modalId of modalTemplateIds) {
    const modalTemplate = templates.find((template) => template.id === modalId);
    for (const fieldId of getModalFieldIds(modalTemplate)) {
      vars.add(fieldId);
    }
  }

  return [...vars].sort();
}

export function buildDisplayedVariables(
  template: MessageTemplate,
  templates: MessageTemplate[],
  dmButtons: DmOpenButtonDraft[] = [],
  channelButtons: ChannelOpenButtonDraft[] = [],
) {
  const base = template.variables;
  if (!isMessageTemplate(template)) {
    return { base, modal: [] as string[] };
  }

  const modal = collectInboundModalVariables(template.id, templates, dmButtons, channelButtons);
  return { base, modal };
}
