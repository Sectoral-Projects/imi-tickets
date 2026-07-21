import type { SearchableSelectOption } from "@/components/searchable-select";
import type { MessageTemplate } from "../schemas/templates";
import { isModalTemplate } from "./template-variables";

/** Member-facing templates that start a new ticket (DM prompt or channel panel). */
const TICKET_ENTRY_TEMPLATE_IDS = new Set([
  "ticket-open-prompt",
  "ticket-channel-panel",
]);

const SYSTEM_CATEGORY_GROUP_ORDER = [
  "tickets",
  "logs",
  "access",
  "commands",
  "system",
] as const;

const SYSTEM_CATEGORY_LABELS: Record<string, string> = {
  tickets: "System: Tickets",
  logs: "System: Logs",
  access: "System: Access",
  commands: "System: Commands",
  system: "System: System",
};

const TICKET_ENTRY_GROUP = "Ticket entry";

export function templateSelectGroupLabel(
  template: Pick<MessageTemplate, "id" | "kind" | "category" | "templateType">,
): string {
  if (isModalTemplate(template)) return "Modal forms";
  if (template.kind === "custom") return "Custom messages";
  if (TICKET_ENTRY_TEMPLATE_IDS.has(template.id)) return TICKET_ENTRY_GROUP;

  const category = (template.category ?? "system").toLowerCase();
  return SYSTEM_CATEGORY_LABELS[category] ?? `System: ${category}`;
}

function groupSortKey(group: string): number {
  if (group === "Custom messages") return 0;
  if (group === "Modal forms") return 1;
  if (group === TICKET_ENTRY_GROUP) return 2;
  const category = SYSTEM_CATEGORY_GROUP_ORDER.find(
    (entry) => SYSTEM_CATEGORY_LABELS[entry] === group,
  );
  if (category) return 3 + SYSTEM_CATEGORY_GROUP_ORDER.indexOf(category);
  if (group.startsWith("System:")) return 100;
  return 50;
}

/** Sort options so groups appear in a stable, readable order. */
export function sortTemplateSelectOptions(
  options: SearchableSelectOption[],
): SearchableSelectOption[] {
  return [...options].sort((a, b) => {
    const groupA = a.group ?? "";
    const groupB = b.group ?? "";
    if (!groupA && groupB) return -1;
    if (groupA && !groupB) return 1;
    if (groupA !== groupB) {
      const rank = groupSortKey(groupA) - groupSortKey(groupB);
      if (rank !== 0) return rank;
      return groupA.localeCompare(groupB);
    }
    return a.label.localeCompare(b.label);
  });
}

export function toTemplateSelectOptions(
  templates: MessageTemplate[],
  options: {
    /** When true, only message templates (excludes modals). */
    messagesOnly?: boolean;
    /** When true, only modal templates. */
    modalsOnly?: boolean;
  } = {},
): SearchableSelectOption[] {
  const filtered = templates.filter((template) => {
    if (options.messagesOnly) return !isModalTemplate(template);
    if (options.modalsOnly) return isModalTemplate(template);
    return true;
  });

  return sortTemplateSelectOptions(
    filtered.map((template) => ({
      value: template.id,
      label: template.name,
      keywords: `${template.id} ${template.category ?? ""}`,
      group: templateSelectGroupLabel(template),
    })),
  );
}
