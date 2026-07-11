import { cn } from "@/lib/utils";
import { accentIntToStyle } from "../utils/component-v2";

const CONTAINER_TYPE = 17;
const TEXT_DISPLAY_TYPE = 10;
const ACTION_ROW_TYPE = 1;
const BUTTON_TYPE = 2;

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function TextPreview({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, index) => {
        if (line.startsWith("# ")) {
          return (
            <p
              key={`${index}:${line}`}
              className="text-base leading-snug font-semibold text-discord-preview-foreground"
            >
              {renderInlineMarkdown(line.slice(2))}
            </p>
          );
        }

        if (line.startsWith("## ")) {
          return (
            <p
              key={`${index}:${line}`}
              className="text-sm leading-snug font-semibold text-discord-preview-foreground"
            >
              {renderInlineMarkdown(line.slice(3))}
            </p>
          );
        }

        if (line.startsWith("-# ")) {
          const subtext = line.slice(3);
          return (
            <p key={`${index}:${line}`} className="pt-0.5">
              <span className="inline-block rounded bg-discord-preview-timestamp px-1.5 py-0.5 text-xs leading-4 text-discord-preview-muted">
                {renderInlineMarkdown(subtext)}
              </span>
            </p>
          );
        }

        if (line.length === 0) {
          return <div key={`${index}:spacer`} className="h-1" />;
        }

        return (
          <p
            key={`${index}:${line}`}
            className="text-sm leading-relaxed whitespace-pre-wrap text-discord-preview-foreground"
          >
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

function ButtonPreview({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="rounded bg-discord-preview-timestamp px-3 py-1.5 text-sm font-medium text-discord-preview-foreground"
    >
      {label}
    </button>
  );
}

function ActionRowPreview({ components }: { components: unknown[] }) {
  const buttons = components.filter(
    (item) =>
      isRecord(item) &&
      item.type === BUTTON_TYPE &&
      typeof (item as { label?: unknown }).label === "string",
  ) as Array<{ label: string }>;

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {buttons.map((button, index) => (
        <ButtonPreview key={`${index}:${button.label}`} label={button.label} />
      ))}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ComponentPreview({ component }: { component: unknown }) {
  if (!component || typeof component !== "object") return null;
  const record = component as Record<string, unknown>;

  if (record.type === ACTION_ROW_TYPE && Array.isArray(record.components)) {
    return <ActionRowPreview components={record.components} />;
  }

  if (record.type === CONTAINER_TYPE) {
    const children = Array.isArray(record.components) ? record.components : [];
    const accent =
      typeof record.accent_color === "number" ? record.accent_color : undefined;

    return (
      <div className="flex overflow-hidden rounded-lg bg-discord-preview-surface">
        <div
          className="w-1 shrink-0"
          style={accent !== undefined ? accentIntToStyle(accent) : undefined}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3.5">
          {children.map((child, index) => (
            <ComponentPreview key={index} component={child} />
          ))}
        </div>
      </div>
    );
  }

  if (record.type === TEXT_DISPLAY_TYPE && typeof record.content === "string") {
    return <TextPreview content={record.content} />;
  }

  return null;
}

export function TemplatePreviewPanel({
  components,
  isLoading,
  error,
}: {
  components: unknown | null;
  isLoading?: boolean;
  error?: string | null;
}) {
  const items = Array.isArray(components)
    ? components
    : components
      ? [components]
      : [];

  return (
    <div
      className={cn(
        "flex min-h-72 flex-col gap-3 rounded-lg bg-discord-preview-canvas p-4",
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-discord-preview-muted uppercase">
        Preview
      </p>
      {isLoading ? (
        <p className="text-sm text-discord-preview-muted">Rendering preview…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-discord-preview-muted">
          Add a block to preview the message.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <ComponentPreview key={index} component={item} />
          ))}
        </div>
      )}
    </div>
  );
}
