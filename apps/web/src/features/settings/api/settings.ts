import { api } from "@/lib/api";
import type {
  SettingsChannelsResponse,
  SettingsForumThreadsResponse,
  SettingsPanelChannelsResponse,
  SettingsRolesResponse,
  SettingsResponse,
  UpdateSettingsInput,
} from "../schemas/settings";

export function fetchSettings() {
  return api.get<SettingsResponse>("/settings");
}

export function fetchClientPreferences() {
  return api.get<{
    useChannelNameForTranscript: boolean;
    canManage: boolean;
    canAdmin: boolean;
  }>("/settings/client-preferences");
}

export function fetchSettingsChannels() {
  return api.get<SettingsChannelsResponse>("/settings/channels");
}

export function fetchSettingsPanelChannels() {
  return api.get<SettingsPanelChannelsResponse>("/settings/panel-channels");
}

export function fetchSettingsForumThreads(channelId: string) {
  return api.get<SettingsForumThreadsResponse>(
    `/settings/channel-panel/forum-threads?channelId=${encodeURIComponent(channelId)}`,
  );
}

export function publishChannelPanel() {
  return api.post<{
    channelId: string;
    messageId: string;
    forumThreadId: string | null;
    channelPanel: SettingsResponse["channelPanel"];
  }>("/settings/channel-panel/publish");
}

export function fetchSettingsRoles() {
  return api.get<SettingsRolesResponse>("/settings/roles");
}

export function updateSettings(input: UpdateSettingsInput) {
  return api.patch<SettingsResponse>("/settings", input);
}
