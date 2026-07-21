import { useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchableSelect } from "@/components/searchable-select";
import { useDeleteTemplate, useTemplates } from "../hooks/templates";
import type { ChannelOpenButtonDraft, DmOpenButtonDraft } from "../schemas/templates";
import {
  TICKET_OPEN_MODE_OPTIONS,
  ticketOpenModeLabel,
  normalizeTicketOpenButtonMode,
  type TicketOpenButtonMode,
} from "../constants";
import { type BuilderState } from "../utils/component-v2";
import {
  createEditDraft,
  isTemplateEditDirty,
  TICKET_CHANNEL_PANEL_ID,
  TICKET_OPEN_PROMPT_ID,
  type TemplateEditDraft,
} from "../utils/template-edit";
import { templateSupportsButtonForward } from "../utils/template-capabilities";
import {
  buildDisplayedVariables,
  filterMessageTemplates,
  filterModalTemplates,
  isModalTemplate,
} from "../utils/template-variables";
import { toTemplateSelectOptions } from "../utils/template-select-options";
import { ComponentBuilder } from "./component-builder";
import { ModalBuilder } from "./modal-builder";
import { CreateTemplateDialog } from "./create-template-dialog";
import { ChannelPanelPublishCta } from "./channel-panel-publish-cta";
import type { SettingsResponse } from "@/features/settings/schemas/settings";

export function TemplatesSettingsSection({
  canManage,
  selectedId,
  onSelectedIdChange,
  templateEdits,
  onTemplateEditChange,
  serverDmButtons,
  serverChannelOpenButtons,
  ticketOpenButtonMode,
  onTicketOpenButtonModeChange,
  forwardTemplateButtonsToStaff,
  onForwardTemplateButtonsToStaffChange,
  channelPanel,
  onChannelPanelChange,
}: {
  canManage: boolean;
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
  templateEdits: Record<string, TemplateEditDraft>;
  onTemplateEditChange: (id: string, edit: TemplateEditDraft | null) => void;
  serverDmButtons: DmOpenButtonDraft[];
  serverChannelOpenButtons: ChannelOpenButtonDraft[];
  ticketOpenButtonMode: TicketOpenButtonMode;
  onTicketOpenButtonModeChange: (mode: TicketOpenButtonMode) => void;
  forwardTemplateButtonsToStaff: boolean;
  onForwardTemplateButtonsToStaffChange: (enabled: boolean) => void;
  channelPanel: SettingsResponse["channelPanel"];
  onChannelPanelChange: (next: SettingsResponse["channelPanel"]) => void;
}) {
  const templatesQuery = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const templates = useMemo(
    () => templatesQuery.data?.templates ?? [],
    [templatesQuery.data?.templates],
  );

  const messageTemplates = useMemo(
    () => filterMessageTemplates(templates),
    [templates],
  );

  const modalTemplates = useMemo(
    () => filterModalTemplates(templates),
    [templates],
  );

  const linkableTemplates = useMemo(
    () =>
      messageTemplates.filter(
        (template) => template.kind === "custom" || template.template !== null,
      ),
    [messageTemplates],
  );

  const templateSelectOptions = useMemo(
    () => toTemplateSelectOptions(templates),
    [templates],
  );

  const selectedTemplate = useMemo(() => {
    if (selectedId) {
      return templates.find((template) => template.id === selectedId) ?? null;
    }
    return templates[0] ?? null;
  }, [selectedId, templates]);

  const isTicketOpenPrompt = selectedTemplate?.id === TICKET_OPEN_PROMPT_ID;
  const isChannelTicketPanel = selectedTemplate?.id === TICKET_CHANNEL_PANEL_ID;
  const isModal = selectedTemplate ? isModalTemplate(selectedTemplate) : false;

  const currentEdit = selectedTemplate
    ? (templateEdits[selectedTemplate.id] ??
        createEditDraft(selectedTemplate, serverDmButtons, serverChannelOpenButtons))
    : null;

  const displayedVariables = useMemo(() => {
    if (!selectedTemplate) return { base: [] as string[], modal: [] as string[] };
    return buildDisplayedVariables(
      selectedTemplate,
      templates,
      serverDmButtons,
      serverChannelOpenButtons,
    );
  }, [selectedTemplate, templates, serverDmButtons, serverChannelOpenButtons]);

  const hasTemplateButtons =
    !isModal &&
    (currentEdit?.builder?.items.some((item) => item.kind === "button") ?? false);
  const showTicketOpeningSettings = isTicketOpenPrompt;
  const showForwardSetting =
    isTicketOpenPrompt ||
    isChannelTicketPanel ||
    (hasTemplateButtons && templateSupportsButtonForward(selectedTemplate!));
  const showButtonSettings = showTicketOpeningSettings || showForwardSetting;

  if (templatesQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message templates</CardTitle>
          <CardDescription>Loading template configuration…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleBuilderChange = (builder: BuilderState) => {
    if (!selectedTemplate || !currentEdit) return;
    onTemplateEditChange(selectedTemplate.id, { ...currentEdit, builder, modalBuilder: undefined });
  };

  const handleModalBuilderChange = (modalBuilder: import("../utils/modal-v2").ModalBuilderState) => {
    if (!selectedTemplate || !currentEdit) return;
    onTemplateEditChange(selectedTemplate.id, { ...currentEdit, modalBuilder, builder: undefined });
  };

  const handleEnabledChange = (enabled: boolean) => {
    if (!selectedTemplate || !currentEdit) return;
    onTemplateEditChange(selectedTemplate.id, { ...currentEdit, enabled });
  };

  const handleStaffCommandChange = (staffCommand: string) => {
    if (!selectedTemplate || !currentEdit) return;
    onTemplateEditChange(selectedTemplate.id, { ...currentEdit, staffCommand });
  };

  const handleReset = async () => {
    if (!selectedTemplate) return;
    setDeleteError(null);
    try {
      if (selectedTemplate.version > 0) {
        await deleteTemplate.mutateAsync(selectedTemplate.id);
      }
      onTemplateEditChange(selectedTemplate.id, null);
    } catch (failure) {
      setDeleteError(
        failure instanceof Error ? failure.message : "Failed to reset template.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-visible">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Message templates</CardTitle>
            <CardDescription>
              Build Component V2 messages with blocks, buttons, preview, and
              drag-and-drop ordering.
            </CardDescription>
          </div>
          <CreateTemplateDialog
            canManage={canManage}
            onCreated={(templateId) => onSelectedIdChange(templateId)}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-select">Message template</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchableSelect
                className="w-full sm:flex-1"
                options={templateSelectOptions}
                value={selectedTemplate?.id ?? ""}
                onValueChange={onSelectedIdChange}
                placeholder="Choose a template"
                searchPlaceholder="Search templates…"
                emptyText="No templates found."
              />
              {selectedTemplate && currentEdit ? (
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="flex items-center gap-2">
                    
                    {isTemplateEditDirty(
                      selectedTemplate,
                      templateEdits[selectedTemplate.id],
                      serverDmButtons,
                      serverChannelOpenButtons,
                    ) ? (
                      <Badge variant="outline">Unsaved</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`template-enabled-${selectedTemplate.id}`}
                      className="text-sm"
                    >
                      Enabled
                    </Label>
                    <Switch
                      id={`template-enabled-${selectedTemplate.id}`}
                      checked={currentEdit.enabled}
                      disabled={!canManage}
                      onCheckedChange={handleEnabledChange}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {selectedTemplate && currentEdit ? (
            <>
              {displayedVariables.base.length > 0 || displayedVariables.modal.length > 0 ? (
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {displayedVariables.base.length > 0 ? (
                    <p>
                      Variables:{" "}
                      {displayedVariables.base.map((variable) => `{{${variable}}}`).join(", ")}
                    </p>
                  ) : null}
                  {displayedVariables.modal.length > 0 ? (
                    <p>
                      From linked modals:{" "}
                      {displayedVariables.modal.map((variable) => `{{${variable}}}`).join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isChannelTicketPanel ? (
                channelPanel.messageId ? (
                  <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    Linked Discord message updates automatically when you save this
                    template. Message ID: {channelPanel.messageId}
                  </p>
                ) : (
                  <ChannelPanelPublishCta
                    value={channelPanel}
                    disabled={!canManage}
                    onChange={onChannelPanelChange}
                  />
                )
              ) : null}

              {selectedTemplate.kind === "custom" && !isModal ? (
                <div className="space-y-2">
                  <Label htmlFor={`template-command-${selectedTemplate.id}`}>
                    Staff command name
                  </Label>
                  <Input
                    id={`template-command-${selectedTemplate.id}`}
                    value={currentEdit.staffCommand}
                    disabled={!canManage}
                    placeholder="rules"
                    onChange={(event) => handleStaffCommandChange(event.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Use !{currentEdit.staffCommand} to send this message.
                  </p>
                </div>
              ) : null}

              {showButtonSettings ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  {showTicketOpeningSettings ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="ticket-open-mode" className="text-sm font-medium">
                          Ticket opening
                        </Label>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                              />
                            }
                          >
                            <CircleHelp className="size-4" />
                            <span className="sr-only">Ticket opening help</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {TICKET_OPEN_MODE_OPTIONS.map((option) => (
                              <p key={option.value}>
                                <span className="font-medium">{option.label}:</span> {option.help}
                              </p>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select
                        value={normalizeTicketOpenButtonMode(ticketOpenButtonMode)}
                        disabled={!canManage}
                        onValueChange={(value) =>
                          onTicketOpenButtonModeChange(value as TicketOpenButtonMode)
                        }
                      >
                        <SelectTrigger id="ticket-open-mode" className="w-full max-w-xs">
                          <SelectValue placeholder="Choose mode">
                            {ticketOpenModeLabel(ticketOpenButtonMode)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_OPEN_MODE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {showForwardSetting ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <Label
                          htmlFor="forward-template-buttons"
                          className="text-sm font-medium"
                        >
                          Forward button responses to staff
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          When a member clicks a button, send the linked template to the ticket
                          channel or forum post for staff to see.
                        </p>
                      </div>
                      <Switch
                        id="forward-template-buttons"
                        checked={forwardTemplateButtonsToStaff}
                        disabled={!canManage}
                        onCheckedChange={onForwardTemplateButtonsToStaffChange}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isModal ? (
                <ModalBuilder
                  value={
                    currentEdit.modalBuilder ??
                    createEditDraft(selectedTemplate, serverDmButtons, serverChannelOpenButtons).modalBuilder!
                  }
                  disabled={!canManage}
                  onChange={handleModalBuilderChange}
                />
              ) : (
                <ComponentBuilder
                  templateId={selectedTemplate.id}
                  value={
                    currentEdit.builder ??
                    createEditDraft(selectedTemplate, serverDmButtons, serverChannelOpenButtons).builder!
                  }
                  previewVariables={selectedTemplate.previewVariables}
                  linkableTemplates={linkableTemplates}
                  modalTemplates={modalTemplates}
                  disabled={!canManage}
                  onChange={handleBuilderChange}
                />
              )}

              {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

              {canManage && selectedTemplate.kind === "system" && selectedTemplate.version > 0 ? (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={deleteTemplate.isPending}
                  >
                    Reset override
                  </Button>
                </div>
              ) : null}

              {canManage && selectedTemplate.kind === "custom" ? (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={deleteTemplate.isPending}
                  >
                    Delete template
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No templates available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
