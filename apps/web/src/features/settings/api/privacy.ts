import { api } from "@/lib/api";
import type { DataCategory, DataDeletionPreview, GdprEraseMode } from "../schemas/privacy";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function previewDataDeletion(categories: DataCategory[]) {
  return api.post<DataDeletionPreview>("/settings/data/delete-preview", { categories });
}

export async function executeDataDeletion(categories: DataCategory[], confirmation: string) {
  return api.post<DataDeletionPreview>("/settings/data/delete", { categories, confirmation });
}

export async function downloadGdprExport(userId: string) {
  const response = await fetch(`${API_BASE}/gdpr/users/${encodeURIComponent(userId)}/export`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to export GDPR data" }));
    throw new Error(error.error ?? "Failed to export GDPR data");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gdpr-export-${userId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function processGdprUser(userId: string, mode: GdprEraseMode, confirmation: string) {
  return api.post<Record<string, unknown>>(`/gdpr/users/${encodeURIComponent(userId)}/process`, {
    mode,
    confirmation,
  });
}
