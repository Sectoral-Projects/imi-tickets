import type { ChannelOpenButtonDraft, DmOpenButtonDraft } from "../schemas/templates";
import {
  normalizeMessageDelivery,
  resolveEmbeddedButtonCustomId,
  TEMPLATE_MODAL_BUTTON_CUSTOM_ID_PREFIX,
} from "./button-actions";
import { DEFAULT_BUTTON_MESSAGE_DELIVERY } from "../schemas/button-actions";

export const TICKET_OPEN_PROMPT_TEMPLATE_ID = "ticket-open-prompt";
export const TICKET_CHANNEL_PANEL_TEMPLATE_ID = "ticket-channel-panel";

export type BuilderTextItem = {
  id: string;
  kind: "text";
  content: string;
};

export type BuilderButtonItem = {
  id: string;
  kind: "button";
  buttonId: string;
  label: string;
  actionType: "message" | "modal" | "open_only";
  templateId: string;
  modalTemplateId: string;
  optionalTag: string;
  subjectTemplate: string;
  enabled: boolean;
  messageDelivery: import("../schemas/button-actions").ButtonMessageDelivery;
  closeTicketOnPress: boolean;
};

export type BuilderItem = BuilderTextItem | BuilderButtonItem;

export type BuilderState = {
  accentColor: number;
  items: BuilderItem[];
};

export type BuildTemplateOptions = {
  embedButtons?: boolean;
  parentTemplateId?: string;
};

export type ParseTemplateOptions = {
  dmButtons?: DmOpenButtonDraft[];
  channelButtons?: ChannelOpenButtonDraft[];
  useDmButtons?: boolean;
  useChannelButtons?: boolean;
  buttonActions?: Record<string, import("../schemas/button-actions").ButtonActionConfig>;
};

export const TEMPLATE_BUTTON_CUSTOM_ID_PREFIX = "msg_btn:";

const CONTAINER_TYPE = 17;
const TEXT_DISPLAY_TYPE = 10;
const ACTION_ROW_TYPE = 1;
const BUTTON_TYPE = 2;
const BUTTON_STYLE_SECONDARY = 2;
export const DEFAULT_ACCENT = 5_793_266;

export const DISCORD_ACCENT_PRESETS = [
  { name: "Blurple", value: 5_793_266 },
  { name: "Green", value: 5_763_719 },
  { name: "Yellow", value: 16_705_333 },
  { name: "Red", value: 15_548_997 },
  { name: "Orange", value: 15_105_570 },
  { name: "Aqua", value: 1_752_220 },
  { name: "Purple", value: 10_181_046 },
  { name: "Fuchsia", value: 15_418_782 },
  { name: "Grey", value: 9_936_031 },
] as const;

export function accentIntToHex(color: number) {
  return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

export function hexToAccentInt(hex: string) {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return DEFAULT_ACCENT;
  return Number.parseInt(normalized, 16);
}

export function accentIntToStyle(color: number) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return { backgroundColor: `rgb(${r} ${g} ${b})` };
}

export function createTextItem(content = ""): BuilderTextItem {
  return { id: crypto.randomUUID(), kind: "text", content };
}

export function createButtonItem(
  partial: Partial<Omit<BuilderButtonItem, "id" | "kind">> = {},
): BuilderButtonItem {
  return {
    id: crypto.randomUUID(),
    kind: "button",
    buttonId: partial.buttonId ?? `button-${crypto.randomUUID().slice(0, 8)}`,
    label: partial.label ?? "New button",
    actionType: partial.actionType ?? "message",
    templateId: partial.templateId ?? "",
    modalTemplateId: partial.modalTemplateId ?? "",
    optionalTag: partial.optionalTag ?? "",
    subjectTemplate: partial.subjectTemplate ?? "",
    enabled: partial.enabled ?? true,
    messageDelivery: partial.messageDelivery ?? DEFAULT_BUTTON_MESSAGE_DELIVERY,
    closeTicketOnPress: partial.closeTicketOnPress ?? false,
  };
}

export function createDefaultBuilderState(name: string): BuilderState {
  return {
    accentColor: DEFAULT_ACCENT,
    items: [createTextItem(`# ${name || "New template"}`)],
  };
}

export function usesDmOpenButtons(templateId: string) {
  return templateId === TICKET_OPEN_PROMPT_TEMPLATE_ID;
}

export function usesChannelOpenButtons(templateId: string) {
  return templateId === TICKET_CHANNEL_PANEL_TEMPLATE_ID;
}

export function usesExternalOpenButtons(templateId: string) {
  return usesDmOpenButtons(templateId) || usesChannelOpenButtons(templateId);
}

export function parseTemplateToBuilder(
  template: unknown | null | undefined,
  fallbackName: string,
  options: ParseTemplateOptions = {},
): BuilderState {
  if (options.useDmButtons) {
    const textItems = parseTextItemsFromTemplate(template, fallbackName);
    const buttonItems = (options.dmButtons ?? []).map((button) =>
      createButtonItem({
        buttonId: button.id,
        label: button.label,
        actionType: button.actionType ?? "message",
        templateId: button.templateId,
        modalTemplateId: button.modalTemplateId ?? "",
        optionalTag: button.optionalTag,
        enabled: button.enabled,
      }),
    );

    return {
      accentColor: readAccentColor(template) ?? DEFAULT_ACCENT,
      items: [...textItems, ...buttonItems],
    };
  }

  if (options.useChannelButtons) {
    const textItems = parseTextItemsFromTemplate(template, fallbackName);
    const buttonItems = (options.channelButtons ?? []).map((button) =>
      createButtonItem({
        buttonId: button.id,
        label: button.label,
        actionType: button.actionType ?? "message",
        templateId: button.templateId,
        modalTemplateId: button.modalTemplateId ?? "",
        optionalTag: button.optionalTag,
        subjectTemplate: button.subjectTemplate,
        enabled: button.enabled,
      }),
    );

    return {
      accentColor: readAccentColor(template) ?? DEFAULT_ACCENT,
      items: [...textItems, ...buttonItems],
    };
  }

  return {
    accentColor: readAccentColor(template) ?? DEFAULT_ACCENT,
    items: parseItemsFromTemplate(template, fallbackName, options.buttonActions),
  };
}

export function buildTemplateFromBuilder(
  state: BuilderState,
  options: BuildTemplateOptions = {},
) {
  return [
    {
      type: CONTAINER_TYPE,
      accent_color: state.accentColor,
      components: buildContainerComponents(
        state.items,
        options.embedButtons ?? false,
        options.parentTemplateId,
      ),
    },
  ];
}

export function extractDmButtonsFromBuilder(state: BuilderState): DmOpenButtonDraft[] {
  return state.items
    .filter((item): item is BuilderButtonItem => item.kind === "button" && item.actionType !== "open_only")
    .map((item) => ({
      id: item.buttonId.trim(),
      label: item.label,
      actionType: item.actionType as DmOpenButtonDraft["actionType"],
      templateId: item.templateId,
      modalTemplateId: item.modalTemplateId,
      optionalTag: item.optionalTag,
      enabled: item.enabled,
    }));
}

export function extractChannelButtonsFromBuilder(state: BuilderState): ChannelOpenButtonDraft[] {
  return state.items
    .filter((item): item is BuilderButtonItem => item.kind === "button")
    .map((item) => ({
      id: item.buttonId.trim(),
      label: item.label,
      actionType: item.actionType,
      templateId: item.templateId,
      modalTemplateId: item.modalTemplateId,
      optionalTag: item.optionalTag,
      subjectTemplate: item.subjectTemplate,
      enabled: item.enabled,
    }));
}

export { extractEmbeddedButtonActions } from "./button-actions";

export function appendButtonsToPreviewComponents(
  components: unknown,
  buttons: BuilderButtonItem[],
  parentTemplateId?: string,
) {
  const enabledButtons = buttons.filter((button) => button.enabled && button.label.trim());
  if (enabledButtons.length === 0) return components;

  const actionRow = buildActionRow(enabledButtons, parentTemplateId);

  const items = Array.isArray(components) ? components : components ? [components] : [];
  if (items.length === 0) return [actionRow];

  const [first, ...rest] = items;
  if (first && typeof first === "object" && "components" in first) {
    const container = first as Record<string, unknown>;
    const children = Array.isArray(container.components) ? container.components : [];
    return [
      {
        ...container,
        components: [...children, actionRow],
      },
      ...rest,
    ];
  }

  return [...items, actionRow];
}

export function builderStatesEqual(a: BuilderState, b: BuilderState) {
  if (a.accentColor !== b.accentColor || a.items.length !== b.items.length) {
    return false;
  }

  return a.items.every((item, index) => {
    const other = b.items[index];
    if (!other || item.kind !== other.kind) return false;

    if (item.kind === "text" && other.kind === "text") {
      return item.content === other.content;
    }

    if (item.kind === "button" && other.kind === "button") {
      return (
        item.buttonId === other.buttonId &&
        item.label === other.label &&
        item.actionType === other.actionType &&
        item.templateId === other.templateId &&
        item.modalTemplateId === other.modalTemplateId &&
        item.optionalTag === other.optionalTag &&
        item.subjectTemplate === other.subjectTemplate &&
        item.enabled === other.enabled &&
        item.messageDelivery === other.messageDelivery &&
        item.closeTicketOnPress === other.closeTicketOnPress
      );
   }

    return false;
  });
}

function buildContainerComponents(
  items: BuilderItem[],
  embedButtons: boolean,
  parentTemplateId?: string,
) {
  if (!embedButtons) {
    return items
      .filter((item): item is BuilderTextItem => item.kind === "text")
      .map((item) => ({
        type: TEXT_DISPLAY_TYPE,
        content: item.content,
      }));
  }

  const components: unknown[] = [];
  let buttonGroup: BuilderButtonItem[] = [];

  const flushButtons = () => {
    if (buttonGroup.length === 0) return;
    components.push(buildActionRow(buttonGroup, parentTemplateId));
    buttonGroup = [];
  };

  for (const item of items) {
    if (item.kind === "text") {
      flushButtons();
      components.push({
        type: TEXT_DISPLAY_TYPE,
        content: item.content,
      });
      continue;
    }

    if (!item.enabled || !item.label.trim()) continue;

    buttonGroup.push(item);
    if (buttonGroup.length >= 5) flushButtons();
  }

  flushButtons();
  return components;
}

function buildActionRow(buttons: BuilderButtonItem[], parentTemplateId?: string) {
  return {
    type: ACTION_ROW_TYPE,
    components: buttons.slice(0, 5).map((button) => ({
      type: BUTTON_TYPE,
      style: BUTTON_STYLE_SECONDARY,
      label: button.label,
      custom_id: parentTemplateId
        ? resolveEmbeddedButtonCustomId(parentTemplateId, button)
        : button.buttonId.trim() || `button-${button.id}`,
    })),
  };
}

function parseItemsFromTemplate(
  template: unknown | null | undefined,
  fallbackName: string,
  buttonActions: ParseTemplateOptions["buttonActions"] = {},
): BuilderItem[] {
  if (!template) {
    return [createTextItem(`# ${fallbackName}`)];
  }

  const parsed = typeof template === "string" ? tryParseJson(template) : template;
  if (!parsed) {
    return [createTextItem(`# ${fallbackName}`)];
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const container = items.find(
    (item) => isRecord(item) && item.type === CONTAINER_TYPE,
  ) as Record<string, unknown> | undefined;

  if (!container) {
    return parseTextItemsFromTemplate(template, fallbackName);
  }

  const components = Array.isArray(container.components) ? container.components : [];
  const parsedItems: BuilderItem[] = [];

  for (const component of components) {
    if (!isRecord(component)) continue;

    if (component.type === TEXT_DISPLAY_TYPE) {
      parsedItems.push(
        createTextItem(String((component as { content?: unknown }).content ?? "")),
      );
      continue;
    }

    if (component.type === ACTION_ROW_TYPE && Array.isArray(component.components)) {
      for (const child of component.components) {
        if (!isRecord(child) || child.type !== BUTTON_TYPE) continue;
        const label = typeof child.label === "string" ? child.label : "Button";
        const customId =
          typeof child.custom_id === "string" ? child.custom_id : `button-${parsedItems.length + 1}`;

        let buttonId = customId;
        let templateId = "";
        let actionType: BuilderButtonItem["actionType"] = "message";

        if (customId.startsWith(TEMPLATE_MODAL_BUTTON_CUSTOM_ID_PREFIX)) {
          const rest = customId.slice(TEMPLATE_MODAL_BUTTON_CUSTOM_ID_PREFIX.length);
          const separator = rest.indexOf(":");
          buttonId = separator > 0 ? rest.slice(separator + 1) : rest;
          actionType = "modal";
        } else if (customId.startsWith(TEMPLATE_BUTTON_CUSTOM_ID_PREFIX)) {
          const rest = customId.slice(TEMPLATE_BUTTON_CUSTOM_ID_PREFIX.length);
          const separator = rest.indexOf(":");
          if (separator > 0) {
            buttonId = rest.slice(separator + 1);
          } else {
            // Legacy msg_btn:<linkedTemplateId>
            templateId = rest;
            buttonId = rest;
          }
        }

        const savedAction = buttonActions?.[buttonId];
        parsedItems.push(
          createButtonItem({
            buttonId,
            label,
            actionType: savedAction?.actionType ?? actionType,
            templateId: savedAction?.templateId ?? templateId,
            modalTemplateId: savedAction?.modalTemplateId ?? "",
            enabled: true,
            messageDelivery: normalizeMessageDelivery(savedAction?.messageDelivery),
            closeTicketOnPress: Boolean(savedAction?.closeTicketOnPress),
          }),
        );
      }
    }
  }

  return parsedItems.length > 0 ? parsedItems : [createTextItem(`# ${fallbackName}`)];
}

function parseTextItemsFromTemplate(
  template: unknown | null | undefined,
  fallbackName: string,
): BuilderTextItem[] {
  if (!template) {
    return [createTextItem(`# ${fallbackName}`)];
  }

  const parsed = typeof template === "string" ? tryParseJson(template) : template;
  if (!parsed) {
    return [createTextItem(`# ${fallbackName}`)];
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const container = items.find(
    (item) => isRecord(item) && item.type === CONTAINER_TYPE,
  ) as Record<string, unknown> | undefined;

  if (container) {
    const components = Array.isArray(container.components) ? container.components : [];
    const blocks = components
      .filter((item) => isRecord(item) && item.type === TEXT_DISPLAY_TYPE)
      .map((item) =>
        createTextItem(String((item as { content?: unknown }).content ?? "")),
      );

    return blocks.length > 0 ? blocks : [createTextItem(`# ${fallbackName}`)];
  }

  const textBlocks = items
    .filter((item) => isRecord(item) && item.type === TEXT_DISPLAY_TYPE)
    .map((item) =>
      createTextItem(String((item as { content?: unknown }).content ?? "")),
    );

  if (textBlocks.length > 0) {
    return textBlocks;
  }

  return [createTextItem(`# ${fallbackName}`)];
}

function readAccentColor(template: unknown | null | undefined) {
  if (!template) return undefined;

  const parsed = typeof template === "string" ? tryParseJson(template) : template;
  if (!parsed) return undefined;

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const container = items.find(
    (item) => isRecord(item) && item.type === CONTAINER_TYPE,
  ) as Record<string, unknown> | undefined;

  return typeof container?.accent_color === "number" ? container.accent_color : undefined;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
