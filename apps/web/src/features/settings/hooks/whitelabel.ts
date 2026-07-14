import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWhitelabel, updateWhitelabel } from "../api/whitelabel";
import type { UpdateWhitelabelInput, WhitelabelResponse } from "../schemas/whitelabel";

export function useWhitelabel(guildId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["settings", "whitelabel", guildId] as const,
    queryFn: () => fetchWhitelabel(guildId),
    enabled,
  });
}

export function useUpdateWhitelabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateWhitelabelInput) => updateWhitelabel(input),
    onSuccess: (data) => {
      queryClient.setQueryData<WhitelabelResponse>(
        ["settings", "whitelabel", data.profile?.guildId ?? null],
        data,
      );
      queryClient.setQueryData<WhitelabelResponse>(["settings", "whitelabel", null], data);
    },
  });
}
