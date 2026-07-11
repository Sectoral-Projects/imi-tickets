import type { ChannelOpenButtonDraft, DmOpenButtonDraft, MessageTemplate } from "../schemas/templates";
import {
  builderStatesEqual,
  buildTemplateFromBuilder,
  extractChannelButtonsFromBuilder,
  extractDmButtonsFromBuilder,
  extractEmbeddedButtonActions,
  parseTemplateToBuilder,
  TICKET_CHANNEL_PANEL_TEMPLATE_ID,
  TICKET_OPEN_PROMPT_TEMPLATE_ID,
  usesChannelOpenButtons,
  usesDmOpenButtons,
  type BuilderState,
} from "./component-v2";
import {
  buildModalTemplateFromBuilder,
  modalBuilderStatesEqual,
  parseModalTemplateToBuilder,
  type ModalBuilderState,
} from "./modal-v2";
import { isModalTemplate } from "./template-variables";

export { TICKET_OPEN_PROMPT_TEMPLATE_ID as TICKET_OPEN_PROMPT_ID, TICKET_CHANNEL_PANEL_TEMPLATE_ID as TICKET_CHANNEL_PANEL_ID };

export type TemplateEditDraft = {
  enabled: boolean;
  staffCommand: string;
  builder?: BuilderState;
  modalBuilder?: ModalBuilderState;
};

export function normalizeDmButtons(buttons: DmOpenButtonDraft[]) {
  return buttons.map((button) => ({
    ...button,
    id: button.id.trim(),
    label: button.label.trim(),
    optionalTag: button.optionalTag.trim(),
  }));
}

export function normalizeChannelButtons(buttons: ChannelOpenButtonDraft[]) {
  return buttons.map((button) => ({
    ...button,
    id: button.id.trim(),
    label: button.label.trim(),
    optionalTag: button.optionalTag.trim(),
    subjectTemplate: button.subjectTemplate.trim(),
  }));
}

function baselineDraft(
  template: MessageTemplate,
  serverDmButtons: DmOpenButtonDraft[],
  serverChannelOpenButtons: ChannelOpenButtonDraft[],
): TemplateEditDraft {
  if (isModalTemplate(template)) {
    return {
      enabled: template.enabled,
      staffCommand: "",
      modalBuilder: parseModalTemplateToBuilder(template.template, template.name),
    };
  }

  return {
    enabled: template.enabled,
    staffCommand: template.staffCommand ?? "",
    builder: parseTemplateToBuilder(
      template.template,
      template.name,
      usesDmOpenButtons(template.id)
        ? { useDmButtons: true, dmButtons: serverDmButtons }
        : usesChannelOpenButtons(template.id)
          ? { useChannelButtons: true, channelButtons: serverChannelOpenButtons }
          : { buttonActions: template.buttonActions },
    ),
  };
}

export function isTemplateEditDirty(
  template: MessageTemplate,
  edit: TemplateEditDraft | undefined,
  serverDmButtons: DmOpenButtonDraft[] = [],
  serverChannelOpenButtons: ChannelOpenButtonDraft[] = [],
) {
  if (!edit) return false;

  const baseline = baselineDraft(template, serverDmButtons, serverChannelOpenButtons);

  if (edit.enabled !== baseline.enabled) return true;
  if (!isModalTemplate(template) && edit.staffCommand.trim() !== baseline.staffCommand.trim()) {
    return true;
  }

  if (isModalTemplate(template)) {
    return !modalBuilderStatesEqual(
      edit.modalBuilder ?? parseModalTemplateToBuilder(null, template.name),
      baseline.modalBuilder ?? parseModalTemplateToBuilder(null, template.name),
    );
  }

  return !builderStatesEqual(
    edit.builder ?? parseTemplateToBuilder(null, template.name),
    baseline.builder ?? parseTemplateToBuilder(null, template.name),
  );
}

export function serializeTemplateEdit(edit: TemplateEditDraft, templateId: string) {
  if (edit.modalBuilder) {
    return {
      enabled: edit.enabled,
      staffCommand: null,
      template: buildModalTemplateFromBuilder(edit.modalBuilder),
      category: "modal" as const,
      dmButtons: undefined,
      channelButtons: undefined,
      buttonActions: undefined,
    };
  }

  const dmButtons = usesDmOpenButtons(templateId);
  const channelButtons = usesChannelOpenButtons(templateId);
  return {
    enabled: edit.enabled,
    staffCommand: edit.staffCommand.trim() || null,
    template: buildTemplateFromBuilder(edit.builder!, {
      embedButtons: !dmButtons && !channelButtons,
      parentTemplateId: templateId,
    }),
    category: undefined,
    dmButtons: dmButtons ? extractDmButtonsFromBuilder(edit.builder!) : undefined,
    channelButtons: channelButtons ? extractChannelButtonsFromBuilder(edit.builder!) : undefined,
    buttonActions:
      dmButtons || channelButtons
        ? undefined
        : extractEmbeddedButtonActions(
            edit.builder!.items.filter((item) => item.kind === "button"),
          ),
  };
}

export function createEditDraft(
  template: MessageTemplate,
  serverDmButtons: DmOpenButtonDraft[] = [],
  serverChannelOpenButtons: ChannelOpenButtonDraft[] = [],
): TemplateEditDraft {
  return baselineDraft(template, serverDmButtons, serverChannelOpenButtons);
}
