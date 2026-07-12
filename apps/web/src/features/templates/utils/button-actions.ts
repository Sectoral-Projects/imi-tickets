import type { BuilderButtonItem } from "./component-v2";
import type {
  ButtonActionConfig,
  ButtonMessageDelivery,
} from "../schemas/button-actions";
import { DEFAULT_BUTTON_MESSAGE_DELIVERY } from "../schemas/button-actions";

export const TEMPLATE_MODAL_BUTTON_CUSTOM_ID_PREFIX = "msg_modal:";
export const TEMPLATE_BUTTON_CUSTOM_ID_PREFIX = "msg_btn:";

function deliveryFields(
  item: BuilderButtonItem,
  hasLinkedTemplate: boolean,
): Pick<ButtonActionConfig, "messageDelivery" | "closeTicketOnPress"> {
  const fields: Pick<ButtonActionConfig, "messageDelivery" | "closeTicketOnPress"> =
    {};
  if (hasLinkedTemplate) {
    fields.messageDelivery =
      item.messageDelivery ?? DEFAULT_BUTTON_MESSAGE_DELIVERY;
  }
  if (item.closeTicketOnPress) {
    fields.closeTicketOnPress = true;
  }
  return fields;
}

export function extractEmbeddedButtonActions(
  items: BuilderButtonItem[],
): Record<string, ButtonActionConfig> {
  const actions: Record<string, ButtonActionConfig> = {};

  for (const item of items) {
    if (!item.enabled || !item.buttonId.trim()) continue;

    if (item.actionType === "modal") {
      const modalTemplateId = item.modalTemplateId.trim();
      if (!modalTemplateId) continue;
      const templateId = item.templateId.trim() || undefined;
      actions[item.buttonId.trim()] = {
        actionType: "modal",
        modalTemplateId,
        templateId,
        ...deliveryFields(item, Boolean(templateId)),
      };
      continue;
    }

    const templateId = item.templateId.trim();
    if (templateId) {
      actions[item.buttonId.trim()] = {
        actionType: "message",
        templateId,
        ...deliveryFields(item, true),
      };
      continue;
    }

    if (item.closeTicketOnPress) {
      actions[item.buttonId.trim()] = {
        actionType: "message",
        closeTicketOnPress: true,
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

  // Message / close side-effect buttons always encode parent + button id so
  // runtime can load buttonActions (delivery + close flags).
  if (button.templateId.trim() || button.closeTicketOnPress) {
    return `${TEMPLATE_BUTTON_CUSTOM_ID_PREFIX}${parentTemplateId}:${buttonId}`;
  }

  return buttonId;
}

export function normalizeMessageDelivery(
  value: string | null | undefined,
): ButtonMessageDelivery {
  switch (value) {
    case "presser":
    case "presser_and_staff":
    case "presser_and_participants":
    case "presser_staff_and_participants":
      return value;
    default:
      return DEFAULT_BUTTON_MESSAGE_DELIVERY;
  }
}

export { createDefaultModalConfig, createDefaultModalField } from "./modal-v2";
