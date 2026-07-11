import type { ModalConfig, ModalFieldConfig } from "../schemas/button-actions";

export type ModalBuilderField = ModalFieldConfig & {
  /** Stable React key; not persisted to the template. */
  clientKey: string;
};

export function createDefaultModalField(): ModalBuilderField {
  return {
    clientKey: crypto.randomUUID(),
    id: `field-${crypto.randomUUID().slice(0, 8)}`,
    label: "Details",
    type: "text",
    required: true,
    placeholder: "",
  };
}

export function createDefaultModalConfig(): ModalConfig {
  return {
    title: "Tell us more",
    fields: [createDefaultModalField()].map(({ clientKey: _clientKey, ...field }) => field),
  };
}

export type ModalBuilderState = {
  title: string;
  fields: ModalBuilderField[];
};

export function createDefaultModalBuilderState(name = "New modal"): ModalBuilderState {
  return {
    title: name.trim() || "New modal",
    fields: [createDefaultModalField()],
  };
}

export function parseModalTemplateToBuilder(
  template: unknown | null | undefined,
  fallbackName: string,
): ModalBuilderState {
  if (!template || typeof template !== "object") {
    return createDefaultModalBuilderState(fallbackName);
  }

  const record = template as Partial<ModalConfig>;
  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : fallbackName;
  const fields = Array.isArray(record.fields)
    ? record.fields
        .filter((field): field is ModalFieldConfig => Boolean(field && typeof field === "object"))
        .map((field) => ({
          clientKey: crypto.randomUUID(),
          ...field,
          id: String(field.id ?? ""),
          label: String(field.label ?? ""),
        }))
    : [];

  return {
    title,
    fields: fields.length > 0 ? fields : [createDefaultModalField()],
  };
}

export function buildModalTemplateFromBuilder(state: ModalBuilderState): ModalConfig {
  return {
    title: state.title.trim(),
    fields: state.fields.map(({ clientKey: _clientKey, ...field }) => {
      if (!field.wordFilter) return field;
      const terms = field.wordFilter.terms.map((term) => term.trim()).filter(Boolean);
      if (terms.length === 0) {
        const { wordFilter: _removed, ...rest } = field;
        return rest;
      }
      return { ...field, wordFilter: { ...field.wordFilter, terms } };
    }),
  };
}

export function modalBuilderStatesEqual(a: ModalBuilderState, b: ModalBuilderState) {
  return JSON.stringify(a) === JSON.stringify(b);
}
