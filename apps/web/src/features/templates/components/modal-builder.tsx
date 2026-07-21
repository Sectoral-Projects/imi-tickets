import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { ModalFieldType } from "../schemas/button-actions";
import {
  createDefaultModalField,
  type ModalBuilderField,
  type ModalBuilderState,
} from "../utils/modal-v2";
import { ModalPreviewPanel } from "./modal-preview";

const FIELD_TYPE_OPTIONS: ReadonlyArray<{ value: ModalFieldType; label: string }> = [
  { value: "text", label: "Text input" },
  { value: "paragraph", label: "Paragraph" },
  { value: "string_select", label: "String select" },
  { value: "radio", label: "Radio group" },
  { value: "checkbox", label: "Checkbox group" },
  { value: "role_select", label: "Role select" },
];

const OPTION_FIELD_TYPES = new Set<ModalFieldType>(["string_select", "radio", "checkbox"]);

export function ModalBuilder({
  value,
  disabled,
  onChange,
}: {
  value: ModalBuilderState;
  disabled?: boolean;
  onChange: (next: ModalBuilderState) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  const updateField = (index: number, patch: Partial<ModalBuilderField>) => {
    onChange({
      ...value,
      fields: value.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    });
  };

  const addField = () => {
    if (value.fields.length >= 5) return;
    onChange({ ...value, fields: [...value.fields, createDefaultModalField()] });
  };

  const removeField = (index: number) => {
    onChange({
      ...value,
      fields: value.fields.filter((_field, fieldIndex) => fieldIndex !== index),
    });
  };

  const moveField = (from: number, to: number) => {
    if (from === to || to < 0 || to >= value.fields.length) return;
    const next = [...value.fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...value, fields: next });
  };

  const finishDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const toggleCollapsed = (fieldKey: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedIds(new Set(value.fields.map((field) => field.clientKey)));
  };

  const expandAll = () => {
    setCollapsedIds(new Set());
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label>Modal title</Label>
          <Input
            value={value.title}
            disabled={disabled}
            maxLength={45}
            placeholder="Form title"
            onChange={(event) => onChange({ ...value, title: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-3">
          {value.fields.length > 1 ? (
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Expand all fields"
                title="Expand all"
                onClick={expandAll}
              >
                <ChevronsUpDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Collapse all fields"
                title="Collapse all"
                onClick={collapseAll}
              >
                <ChevronsDownUp className="size-4" />
              </Button>
            </div>
          ) : null}
          {value.fields.map((field, index) => (
            <div
              key={field.clientKey}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex === null) return;
                moveField(dragIndex, index);
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
                <div className="flex min-w-0 flex-1 items-center gap-1 text-muted-foreground">
                  <button
                    type="button"
                    draggable={!disabled}
                    disabled={disabled}
                    aria-label={`Reorder field ${index + 1}`}
                    onDragStart={(event) => {
                      setDragIndex(index);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={finishDrag}
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-grab hover:bg-muted active:cursor-grabbing",
                    )}
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-expanded={!collapsedIds.has(field.clientKey)}
                    aria-label={
                      collapsedIds.has(field.clientKey)
                        ? `Expand field ${index + 1}`
                        : `Collapse field ${index + 1}`
                    }
                    onClick={() => toggleCollapsed(field.clientKey)}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {collapsedIds.has(field.clientKey) ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium">Field {index + 1}</span>
                    {collapsedIds.has(field.clientKey) ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {field.label.trim() || field.id.trim() || "Untitled field"}
                      </p>
                    ) : null}
                  </div>
                </div>
                {!disabled && value.fields.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(index)}>
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove field</span>
                  </Button>
                ) : null}
              </div>

              {collapsedIds.has(field.clientKey) ? null : (
              <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Field ID</Label>
                  <Input
                    value={field.id}
                    disabled={disabled}
                    onChange={(event) => updateField(index, { id: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Label</Label>
                  <Input
                    value={field.label}
                    disabled={disabled}
                    onChange={(event) => updateField(index, { label: event.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Field type</Label>
                <Select
                  value={field.type}
                  disabled={disabled}
                  onValueChange={(next) =>
                    updateField(index, {
                      type: next as ModalFieldType,
                      options: OPTION_FIELD_TYPES.has(next as ModalFieldType)
                        ? field.options?.length
                          ? field.options
                          : [{ label: "Option 1", value: "option_1" }]
                        : undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(field.type === "text" || field.type === "paragraph") && (
                <div className="flex flex-col gap-2">
                  <Label>Placeholder</Label>
                  <Input
                    value={field.placeholder ?? ""}
                    disabled={disabled}
                    onChange={(event) => updateField(index, { placeholder: event.target.value })}
                  />
                </div>
              )}

              {OPTION_FIELD_TYPES.has(field.type) ? (
                <div className="flex flex-col gap-2">
                  <Label>Options</Label>
                  <div className="flex flex-col gap-2">
                    {(field.options ?? []).map((option, optionIndex) => (
                      <div key={`${field.clientKey}-${optionIndex}`} className="grid gap-2 sm:grid-cols-2">
                        <Input
                          value={option.label}
                          disabled={disabled}
                          placeholder="Label"
                          onChange={(event) => {
                            const options = [...(field.options ?? [])];
                            options[optionIndex] = { ...option, label: event.target.value };
                            updateField(index, { options });
                          }}
                        />
                        <Input
                          value={option.value}
                          disabled={disabled}
                          placeholder="Value"
                          onChange={(event) => {
                            const options = [...(field.options ?? [])];
                            options[optionIndex] = { ...option, value: event.target.value };
                            updateField(index, { options });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <Label className="text-sm">Required</Label>
                <Switch
                  checked={field.required ?? false}
                  disabled={disabled}
                  onCheckedChange={(required) => updateField(index, { required })}
                />
              </div>

              {field.type === "text" || field.type === "paragraph" ? (
                <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm">Word filter</Label>
                    <Select
                      value={field.wordFilter?.mode ?? "off"}
                      disabled={disabled}
                      onValueChange={(mode) => {
                        if (mode === "off" || mode == null) {
                          updateField(index, { wordFilter: undefined });
                          return;
                        }
                        if (mode !== "blacklist" && mode !== "whitelist") return;
                        updateField(index, {
                          wordFilter: {
                            mode,
                            match: field.wordFilter?.match ?? "keyword",
                            terms: field.wordFilter?.terms?.length
                              ? field.wordFilter.terms
                              : [""],
                          },
                        });
                      }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">Off</SelectItem>
                        <SelectItem value="blacklist">Blacklist</SelectItem>
                        <SelectItem value="whitelist">Whitelist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {field.wordFilter ? (
                    <>
                      <Select
                        value={field.wordFilter.match}
                        disabled={disabled}
                        onValueChange={(match) => {
                          if (match !== "keyword" && match !== "exact") return;
                          updateField(index, {
                            wordFilter: { ...field.wordFilter!, match },
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="keyword">Keyword</SelectItem>
                          <SelectItem value="exact">Exact</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex flex-col gap-2">
                        {field.wordFilter.terms.map((term, termIndex) => (
                          <div key={termIndex} className="flex gap-2">
                            <Input
                              value={term}
                              disabled={disabled}
                              placeholder="Term or URL host"
                              onChange={(event) => {
                                const terms = [...field.wordFilter!.terms];
                                terms[termIndex] = event.target.value;
                                updateField(index, {
                                  wordFilter: { ...field.wordFilter!, terms },
                                });
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={disabled}
                              onClick={() => {
                                const terms = field.wordFilter!.terms.filter(
                                  (_t, i) => i !== termIndex,
                                );
                                updateField(index, {
                                  wordFilter:
                                    terms.length > 0
                                      ? { ...field.wordFilter!, terms }
                                      : undefined,
                                });
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        ))}
                        {!disabled && (field.wordFilter.terms.length ?? 0) < 100 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateField(index, {
                                wordFilter: {
                                  ...field.wordFilter!,
                                  terms: [...field.wordFilter!.terms, ""],
                                },
                              })
                            }
                          >
                            <Plus data-icon="inline-start" />
                            Add term
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              </>
              )}
            </div>
          ))}
        </div>

        {!disabled && value.fields.length < 5 ? (
          <Button type="button" variant="outline" onClick={addField}>
            <Plus className="size-4" />
            Add field
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 self-stretch">
        <div className="md:sticky md:top-4 md:max-h-[calc(100svh-8rem)] md:overflow-y-auto">
          <ModalPreviewPanel
            value={{ title: value.title, fields: value.fields.map(({ clientKey: _clientKey, ...field }) => field) }}
          />
        </div>
      </div>
    </div>
  );
}
