import type { ModalConfig, ModalFieldConfig, ModalFieldType } from "../schemas/button-actions";

const FIELD_LABELS: Record<ModalFieldType, string> = {
  text: "Text input",
  paragraph: "Paragraph",
  string_select: "String select",
  radio: "Radio group",
  checkbox: "Checkbox group",
  role_select: "Role select",
};

function FieldPreview({ field }: { field: ModalFieldConfig }) {
  const optionFieldTypes = new Set<ModalFieldType>(["string_select", "radio", "checkbox"]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-discord-preview-foreground">
          {field.label}
          {field.required ? <span className="text-destructive"> *</span> : null}
        </label>
        <span className="rounded bg-discord-preview-timestamp px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-discord-preview-muted">
          {FIELD_LABELS[field.type]}
        </span>
      </div>

      {field.type === "text" || field.type === "paragraph" ? (
        <div
          className={
            field.type === "paragraph"
              ? "min-h-16 rounded-md border border-discord-preview-timestamp bg-discord-preview-surface px-3 py-2 text-sm text-discord-preview-muted"
              : "h-9 rounded-md border border-discord-preview-timestamp bg-discord-preview-surface px-3 py-2 text-sm text-discord-preview-muted"
          }
        >
          {field.placeholder?.trim() || "Enter value…"}
        </div>
      ) : null}

      {optionFieldTypes.has(field.type) ? (
        <div className="flex flex-col gap-1.5">
          {(field.options ?? []).map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-sm text-discord-preview-foreground"
            >
              <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-discord-preview-timestamp" />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}

      {field.type === "role_select" ? (
        <div className="h-9 rounded-md border border-discord-preview-timestamp bg-discord-preview-surface px-3 py-2 text-sm text-discord-preview-muted">
          {field.placeholder?.trim() || "Choose a role"}
        </div>
      ) : null}

      <p className="text-[11px] text-discord-preview-muted">Variable: {"{{"}{field.id}{"}}"}</p>
    </div>
  );
}

export function ModalPreviewPanel({
  value,
}: {
  value: ModalConfig;
}) {
  return (
    <div className="flex min-h-72 flex-col gap-3 rounded-lg bg-discord-preview-canvas p-4">
      <p className="text-xs font-semibold tracking-wide text-discord-preview-muted uppercase">
        Preview
      </p>
      <div className="rounded-lg bg-discord-preview-surface p-4 shadow-sm">
        <p className="mb-4 text-base font-semibold text-discord-preview-foreground">
          {value.title.trim() || "Modal title"}
        </p>
        <div className="flex flex-col gap-4">
          {value.fields.map((field) => (
            <FieldPreview key={field.id} field={field} />
          ))}
        </div>
      </div>
    </div>
  );
}
