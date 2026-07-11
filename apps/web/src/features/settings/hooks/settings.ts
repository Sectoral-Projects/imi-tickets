import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSettings,
  fetchSettingsChannels,
  fetchSettingsForumThreads,
  fetchSettingsPanelChannels,
  fetchSettingsRoles,
  publishChannelPanel,
  updateSettings,
} from "../api/settings";
import type { UpdateSettingsInput } from "../schemas/settings";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"] as const,
    queryFn: fetchSettings,
  });
}

export function useSettingsChannels(enabled: boolean) {
  return useQuery({
    queryKey: ["settings", "channels"] as const,
    queryFn: fetchSettingsChannels,
    enabled,
  });
}

export function useSettingsPanelChannels(enabled: boolean) {
  return useQuery({
    queryKey: ["settings", "panel-channels"] as const,
    queryFn: fetchSettingsPanelChannels,
    enabled,
  });
}

export function useSettingsForumThreads(channelId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["settings", "forum-threads", channelId] as const,
    queryFn: () => fetchSettingsForumThreads(channelId!),
    enabled: enabled && Boolean(channelId),
  });
}

export function usePublishChannelPanel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishChannelPanel,
    onSuccess: (data) => {
      queryClient.setQueryData<import("../schemas/settings").SettingsResponse>(
        ["settings"],
        (current) =>
          current
            ? {
                ...current,
                channelPanel: data.channelPanel,
              }
            : current,
      );
    },
  });
}

export function useSettingsRoles(enabled: boolean) {
  return useQuery({
    queryKey: ["settings", "roles"] as const,
    queryFn: fetchSettingsRoles,
    enabled,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => updateSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
    },
  });
}
