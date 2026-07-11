/** Discord-style preview text: long date, then short time, without a locale "at" separator. */
export function formatPreviewTimestamp(date = new Date(), locale?: string | string[]) {
  const datePart = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
  const timePart = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
  return `${datePart} ${timePart}`;
}

export function buildPreviewVariables(
  vars: Record<string, unknown> = {},
  date = new Date(),
) {
  return {
    ...vars,
    timestamp: formatPreviewTimestamp(date),
  };
}
