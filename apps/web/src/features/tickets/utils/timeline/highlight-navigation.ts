const IN_VIEW_VISIBLE_RATIO = 0.4;
const IN_VIEW_MIN_PX = 48;

export function isHighlightInView(element: Element, viewport: HTMLElement) {
  const elementRect = element.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const visibleTop = Math.max(elementRect.top, viewportRect.top);
  const visibleBottom = Math.min(elementRect.bottom, viewportRect.bottom);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const threshold = Math.min(elementRect.height * IN_VIEW_VISIBLE_RATIO, IN_VIEW_MIN_PX);

  return visibleHeight >= threshold;
}

export type HighlightPosition = "above" | "below" | "visible";

export function classifyHighlightElement(
  element: Element,
  viewport: HTMLElement,
): HighlightPosition {
  if (isHighlightInView(element, viewport)) return "visible";

  const rect = element.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const elementCenter = rect.top + rect.height / 2;
  const viewportCenter = (viewportRect.top + viewportRect.bottom) / 2;

  return elementCenter < viewportCenter ? "above" : "below";
}
