import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { previewTemplate } from "../api/templates";
import type { MessageTemplate } from "../schemas/templates";
import { buildPreviewVariables } from "../utils/preview-variables";
import {
  appendButtonsToPreviewComponents,
  buildTemplateFromBuilder,
  createButtonItem,
  createTextItem,
  usesDmOpenButtons,
  usesChannelOpenButtons,
  usesExternalOpenButtons,
  type BuilderButtonItem,
  type BuilderItem,
  type BuilderState,
  type BuilderTextItem,
} from "../utils/component-v2";
import { AccentColorPicker } from "./accent-color-picker";
import { TemplatePreviewPanel } from "./template-preview";
import { VariableHighlightTextarea } from "./variable-highlight-textarea";

export function ComponentBuilder({
  templateId,
  value,
  previewVariables = {},
  linkableTemplates = [],
  modalTemplates = [],
  disabled,
  onChange,
}: {
  templateId: string;
  value: BuilderState;
  previewVariables?: Record<string, unknown>;
  linkableTemplates?: MessageTemplate[];
  modalTemplates?: MessageTemplate[];
  disabled?: boolean;
  onChange: (next: BuilderState) => void;
}) {
  const dmOpenButtons = usesDmOpenButtons(templateId);
  const channelOpenButtons = usesChannelOpenButtons(templateId);
  const externalOpenButtons = usesExternalOpenButtons(templateId);
  const embedButtonsInTemplate = !externalOpenButtons;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [previewComponents, setPreviewComponents] = useState<unknown | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewMinute, setPreviewMinute] = useState(() =>
    Math.floor(Date.now() / 60_000),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPreviewMinute(Math.floor(Date.now() / 60_000));
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const textItems = useMemo(
    () =>
      value.items.filter(
        (item): item is BuilderTextItem => item.kind === "text",
      ),
    [value.items],
  );
  const buttonItems = useMemo(
    () =>
      value.items.filter(
        (item): item is BuilderButtonItem => item.kind === "button",
      ),
    [value.items],
  );
  const templatePayload = useMemo(
    () =>
      buildTemplateFromBuilder(value, {
        embedButtons: embedButtonsInTemplate,
        parentTemplateId: templateId,
      }),
    [value, embedButtonsInTemplate, templateId],
  );
  const resolvedPreviewVariables = useMemo(
    () =>
      buildPreviewVariables(previewVariables, new Date(previewMinute * 60_000)),
    [previewVariables, previewMinute],
  );

  const canPreview = textItems.length > 0;

  useEffect(() => {
    if (!canPreview) return;

    const timeout = window.setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await previewTemplate(
          templateId,
          templatePayload,
          resolvedPreviewVariables,
        );
        setPreviewComponents(
          embedButtonsInTemplate
            ? result.components
            : appendButtonsToPreviewComponents(result.components, buttonItems, templateId),
        );
      } catch (failure) {
        setPreviewError(
          failure instanceof Error
            ? failure.message
            : "Failed to render preview.",
        );
        setPreviewComponents(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [
    canPreview,
    templateId,
    templatePayload,
    resolvedPreviewVariables,
    buttonItems,
    embedButtonsInTemplate,
  ]);

  const displayedComponents = canPreview ? previewComponents : null;
  const displayedError = canPreview ? previewError : null;
  const displayedLoading = canPreview && previewLoading;

  const updateItem = (index: number, patch: Partial<BuilderItem>) => {
    onChange({
      ...value,
      items: value.items.map((item, itemIndex) =>
        itemIndex === index ? ({ ...item, ...patch } as BuilderItem) : item,
      ),
    });
  };

  const moveItem = (from: number, to: number) => {
    if (from === to || to < 0 || to >= value.items.length) return;
    const next = [...value.items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...value, items: next });
  };

  const addTextItem = () => {
    onChange({
      ...value,
      items: [...value.items, createTextItem("New section")],
    });
  };

  const addButtonItem = () => {
    onChange({
      ...value,
      items: [
        ...value.items,
        createButtonItem({
          templateId: linkableTemplates[0]?.id ?? "",
          modalTemplateId: modalTemplates[0]?.id ?? "",
        }),
      ],
    });
  };

  const removeItem = (index: number) => {
    onChange({
      ...value,
      items: value.items.filter((_item, itemIndex) => itemIndex !== index),
    });
  };

  const finishDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label>Accent color</Label>
          <AccentColorPicker
            value={value.accentColor}
            disabled={disabled}
            onChange={(accentColor) => onChange({ ...value, accentColor })}
          />
        </div>

        <div className="flex flex-col gap-3">
          {value.items.map((item, index) => (
            <div
              key={item.id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex === null) return;
                moveItem(dragIndex, index);
                finishDrag();
              }}
              onDragLeave={() => {
                if (dropIndex === index) setDropIndex(null);
              }}
              className={cn(
                "flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-colors",
                dropIndex === index && dragIndex !== null && dragIndex !== index
                  ? "border-primary/40 bg-muted/30"
                  : undefined,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <button
                    type="button"
                    draggable={!disabled}
                    disabled={disabled}
                    aria-label={`Reorder ${item.kind} ${index + 1}`}
                    onDragStart={(event) => {
                      setDragIndex(index);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={finishDrag}
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-grab hover:bg-muted active:cursor-grabbing",
                    )}
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <span className="text-xs font-medium">
                    {item.kind === "text"
                      ? `Block ${value.items.slice(0, index + 1).filter((entry) => entry.kind === "text").length}`
                      : "Button"}
                  </span>
                </div>
                {!disabled && value.items.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove item</span>
                  </Button>
                ) : null}
              </div>

              {item.kind === "text" ? (
                <VariableHighlightTextarea
                  value={item.content}
                  disabled={disabled}
                  onChange={(event) =>
                    updateItem(index, { content: event.target.value })
                  }
                  className="min-h-24 text-sm"
                  placeholder="Markdown content"
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {dmOpenButtons ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label>Button ID</Label>
                        <Input
                          value={item.buttonId}
                          disabled={disabled}
                          placeholder="bug"
                          onChange={(event) =>
                            updateItem(index, { buttonId: event.target.value })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Label</Label>
                        <Input
                          value={item.label}
                          disabled={disabled}
                          placeholder="Bug"
                          onChange={(event) =>
                            updateItem(index, { label: event.target.value })
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Label</Label>
                        <Input
                          value={item.label}
                          disabled={disabled}
                          placeholder="Button label"
                          onChange={(event) =>
                            updateItem(index, { label: event.target.value })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Button ID</Label>
                        <Input
                          value={item.buttonId}
                          disabled={disabled}
                          placeholder="button-id"
                          onChange={(event) =>
                            updateItem(index, { buttonId: event.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                  {dmOpenButtons ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`optional-tag-${item.id}`}>
                          Optional ticket tag
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
                            <span className="sr-only">Optional tag help</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            Applied when a ticket is opened from this button in
                            before-open mode.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id={`optional-tag-${item.id}`}
                        value={item.optionalTag}
                        disabled={disabled}
                        placeholder="Optional ticket tag"
                        onChange={(event) =>
                          updateItem(index, {
                            optionalTag: event.target.value,
                          })
                        }
                      />
                    </div>
                  ) : null}
                  {channelOpenButtons ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`optional-tag-${item.id}`}>
                            Optional ticket tag
                          </Label>
                        </div>
                        <Input
                          id={`optional-tag-${item.id}`}
                          value={item.optionalTag}
                          disabled={disabled}
                          placeholder="Optional ticket tag"
                          onChange={(event) =>
                            updateItem(index, {
                              optionalTag: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`subject-template-${item.id}`}>
                            Ticket subject template
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
                              <span className="sr-only">Subject template help</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              Mustache template for the ticket subject. Use {"{{buttonLabel}}"},
                              {"{{user}}"}, {"{{userId}}"}, {"{{timestamp}}"}, and modal field IDs
                              like {"{{summary}}"}.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <VariableHighlightTextarea
                          id={`subject-template-${item.id}`}
                          value={item.subjectTemplate}
                          disabled={disabled}
                          placeholder="{{buttonLabel}}"
                          rows={2}
                          onChange={(event) =>
                            updateItem(index, {
                              subjectTemplate: event.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <Label>Button action</Label>
                    <Select
                      value={item.actionType}
                      disabled={disabled}
                      onValueChange={(actionType) =>
                        updateItem(index, {
                          actionType: actionType as BuilderButtonItem["actionType"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="message">Send component message</SelectItem>
                        <SelectItem value="modal">Open modal form</SelectItem>
                        {channelOpenButtons ? (
                          <SelectItem value="open_only">Open ticket only</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </div>
                  {item.actionType === "open_only" ? (
                    <p className="text-sm text-muted-foreground">
                      Opens a ticket and DMs the member without sending a linked template to staff.
                    </p>
                  ) : null}
                  {item.actionType === "message" ? (
                    <div className="flex flex-col gap-2">
                      <Label>
                        {dmOpenButtons ? "Linked template" : "Component message template"}
                      </Label>
                      <Select
                        value={item.templateId}
                        disabled={disabled}
                        onValueChange={(nextTemplateId) =>
                          updateItem(index, { templateId: nextTemplateId ?? "" })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose template" />
                        </SelectTrigger>
                        <SelectContent>
                          {linkableTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : item.actionType === "modal" ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Modal template</Label>
                        <Select
                          value={item.modalTemplateId}
                          disabled={disabled}
                          onValueChange={(nextModalTemplateId) =>
                            updateItem(index, { modalTemplateId: nextModalTemplateId ?? "" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose modal template" />
                          </SelectTrigger>
                          <SelectContent>
                            {modalTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Submit template (optional)</Label>
                        <Select
                          value={item.templateId || "__none__"}
                          disabled={disabled}
                          onValueChange={(nextTemplateId) =>
                            updateItem(index, {
                              templateId: nextTemplateId === "__none__" ? "" : nextTemplateId ?? "",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="No follow-up message" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No follow-up message</SelectItem>
                            {linkableTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Enabled</Label>
                    <Switch
                      checked={item.enabled}
                      disabled={disabled}
                      onCheckedChange={(enabled) =>
                        updateItem(index, { enabled })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {!disabled ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none",
                "hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              <Plus className="size-4" />
              Add
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              <DropdownMenuItem onClick={addTextItem}>
                Text block
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addButtonItem}>
                Button
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="min-h-0 self-stretch">
        <div className="md:sticky md:top-4 md:max-h-[calc(100svh-8rem)] md:overflow-y-auto">
          <TemplatePreviewPanel
            components={displayedComponents}
            isLoading={displayedLoading}
            error={displayedError}
          />
        </div>
      </div>
    </div>
  );
}
