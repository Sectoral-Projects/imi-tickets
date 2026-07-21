import { useMemo, useState } from "react";
import { ChannelPicker } from "@/features/onboarding/components/guild-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  usePublishChannelPanel,
  useSettingsForumThreads,
  useSettingsPanelChannels,
  useUpdateSettings,
} from "@/features/settings/hooks/settings";
import type { SettingsResponse } from "@/features/settings/schemas/settings";

type ChannelPanelDraft = SettingsResponse["channelPanel"];

/**
 * Shown on the Channel ticket panel template when Discord has no linked message yet.
 * Saves the chosen channel (if needed) then publishes.
 */
export function ChannelPanelPublishCta({
  value,
  disabled = false,
  onChange,
}: {
  value: ChannelPanelDraft;
  disabled?: boolean;
  onChange: (next: ChannelPanelDraft) => void;
}) {
  const panelChannelsQuery = useSettingsPanelChannels(true);
  const updateSettings = useUpdateSettings();
  const publishPanel = usePublishChannelPanel();
  const [error, setError] = useState<string | null>(null);

  const selectedChannel = useMemo(
    () => panelChannelsQuery.data?.channels.find((channel) => channel.id === value.channelId),
    [panelChannelsQuery.data?.channels, value.channelId],
  );
  const isForumChannel = selectedChannel?.type === "forum";

  const forumThreadsQuery = useSettingsForumThreads(
    isForumChannel ? value.channelId : null,
    isForumChannel,
  );

  const panelChannelOptions = useMemo(
    () =>
      (panelChannelsQuery.data?.channels ?? []).map((channel) => ({
        id: channel.id,
        name:
          channel.type === "forum" ? `${channel.name} (forum)` : `#${channel.name}`,
      })),
    [panelChannelsQuery.data?.channels],
  );

  const forumThreadOptions = useMemo(
    () => forumThreadsQuery.data?.threads ?? [],
    [forumThreadsQuery.data?.threads],
  );

  const busy = updateSettings.isPending || publishPanel.isPending;

  async function handlePublish() {
    setError(null);
    if (!value.channelId) {
      setError("Choose a channel before publishing.");
      return;
    }

    try {
      await updateSettings.mutateAsync({
        channelPanel: {
          enabled: true,
          channelId: value.channelId,
          forumThreadId: value.forumThreadId,
          forumPostTitle: value.forumPostTitle,
        },
      });
      const result = await publishPanel.mutateAsync();
      onChange(result.channelPanel);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Failed to publish panel");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish panel to Discord</CardTitle>
        <CardDescription>
          This panel is not linked to a Discord message yet. Choose a channel and publish when
          you are ready — saving the template alone will not post it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Panel channel</Label>
          <ChannelPicker
            channels={panelChannelOptions}
            value={value.channelId ?? ""}
            disabled={disabled || panelChannelsQuery.isLoading || busy}
            placeholder={panelChannelsQuery.isLoading ? "Loading channels…" : "Choose a channel"}
            searchPlaceholder="Search channels…"
            emptyMessage="No text or forum channels found."
            noneLabel="No channel"
            onValueChange={(channelId) =>
              onChange({
                ...value,
                channelId: channelId || null,
                forumThreadId: null,
              })
            }
          />
        </div>

        {isForumChannel ? (
          <>
            <div className="flex flex-col gap-2">
              <Label>Existing forum post (optional)</Label>
              <ChannelPicker
                channels={forumThreadOptions}
                value={value.forumThreadId ?? ""}
                disabled={disabled || forumThreadsQuery.isLoading || busy}
                placeholder={
                  forumThreadsQuery.isLoading ? "Loading forum posts…" : "Auto-create post"
                }
                searchPlaceholder="Search forum posts…"
                emptyMessage="No forum posts found. Leave blank to auto-create one on publish."
                noneLabel="Auto-create post"
                onValueChange={(threadId) =>
                  onChange({
                    ...value,
                    forumThreadId: threadId || null,
                  })
                }
              />
            </div>

            {!value.forumThreadId ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="templates-channel-panel-forum-title">Forum post title</Label>
                <Input
                  id="templates-channel-panel-forum-title"
                  value={value.forumPostTitle ?? ""}
                  disabled={disabled || busy}
                  placeholder="Open a ticket"
                  onChange={(event) =>
                    onChange({
                      ...value,
                      forumPostTitle: event.target.value || null,
                    })
                  }
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div>
          <Button
            type="button"
            disabled={disabled || !value.channelId || busy}
            onClick={() => void handlePublish()}
          >
            {busy ? "Publishing…" : "Publish panel to Discord"}
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
