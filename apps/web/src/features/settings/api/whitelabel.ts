import { api } from "@/lib/api";
import type { UpdateWhitelabelInput, WhitelabelResponse } from "../schemas/whitelabel";

export function fetchWhitelabel(guildId?: string | null) {
  const query = guildId ? `?guildId=${encodeURIComponent(guildId)}` : "";
  return api.get<WhitelabelResponse>(`/settings/whitelabel${query}`);
}

export function updateWhitelabel(input: UpdateWhitelabelInput) {
  return api.patch<WhitelabelResponse>("/settings/whitelabel", input);
}
