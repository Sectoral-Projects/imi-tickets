import type { ReactNode } from "react";

const TEMPLATE_VARIABLE_PATTERN = /(\{\{\{[^}]+\}\}\}|\{\{[^}]+\}\})/g;

export function splitTemplateVariables(text: string) {
  const segments: Array<{ type: "text" | "variable"; value: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    segments.push({ type: "variable", value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

export function highlightTemplateVariables(text: string): ReactNode {
  if (!text) return null;

  return splitTemplateVariables(text).map((segment, index) =>
    segment.type === "variable" ? (
      <span
        key={index}
        className="box-decoration-clone rounded-sm bg-primary/10 px-0.5 py-px font-medium text-primary"
      >
        {segment.value}
      </span>
    ) : (
      <span key={index}>{segment.value}</span>
    ),
  );
}
