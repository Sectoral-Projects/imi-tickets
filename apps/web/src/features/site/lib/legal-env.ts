const DEFAULT_LEGAL_VALUE = "CHANGE_ME";

function readLegalEnv(raw: string | undefined) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : DEFAULT_LEGAL_VALUE;
}

export function getLegalContact() {
  return readLegalEnv(import.meta.env.VITE_LEGAL_CONTACT);
}

export function getLegalName() {
  return readLegalEnv(import.meta.env.VITE_LEGAL_NAME);
}

export function getLegalUrl() {
  return readLegalEnv(import.meta.env.VITE_LEGAL_URL);
}

export function getLegalJurisdiction() {
  return readLegalEnv(import.meta.env.VITE_LEGAL_JURISDICTION);
}

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
