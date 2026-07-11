import type { BuilderButtonItem } from "./component-v2";
import type { ButtonActionConfig } from "../schemas/button-actions";

export const TEMPLATE_MODAL_BUTTON_CUSTOM_ID_PREFIX = "msg_modal:";

export function extractEmbeddedButtonActions(
  items: BuilderButtonItem[],
): Record<string, ButtonActionConfig> {
  const actions: Record<string, ButtonActionConfig> = {};

  for (const item of items) {
    if (!item.enabled || !item.buttonId.trim()) continue;

    if (item.actionType === "modal") {
      const modalTemplateId = item.modalTemplateId.trim();
      if (!modalTemplateId) continue;
      actions[item.buttonId.trim()] = {
        actionType: "modal",
        modalTemplateId,
        templateId: item.templateId.trim() || undefined,
      };
      continue;
    }

    if (item.templateId.trim()) {
      actions[item.buttonId.trim()] = {
        actionType: "message",
        templateId: item.templateId.trim(),
      };
    }
  }

  return actions;
}

export function resolveEmbeddedButtonCustomId(
  parentTemplateId: string,
  button: BuilderButtonItem,
) {
  const buttonId = button.buttonId.trim() || button.id;
  if (button.actionType === "modal") {
    return `${TEMPLATE_MODAL_BUTTON_CUSTOM_ID_PREFIX}${parentTemplateId}:${buttonId}`;
  }

  const templateId = button.templateId.trim();
  if (templateId) {
    return `msg_btn:${templateId}`;
  }

  return buttonId;
}

export { createDefaultModalConfig, createDefaultModalField } from "./modal-v2";