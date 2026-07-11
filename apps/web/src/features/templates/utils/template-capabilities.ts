import type { MessageTemplate } from "../schemas/templates";

/** Member-facing templates whose buttons can forward linked responses to staff. */
export function templateSupportsButtonForward(template: Pick<MessageTemplate, "kind" | "supportsButtonForward">) {
  if (template.kind === "custom") return true;
  return Boolean(template.supportsButtonForward);
}
