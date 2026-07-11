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
import { Switch } from "@/components/ui/switch";
import {
  usePublishChannelPanel,
  useSettingsForumThreads,
  useSettingsPanelChannels,
} from "../hooks/settings";
import type { SettingsResponse } from "../schemas/settings";

type ChannelPanelDraft = SettingsResponse["channelPanel"];

export function ChannelPanelSettingsSection({
  value,
  disabled = false,
  onChange,
}: {
  value: ChannelPanelDraft;
  disabled?: boolean;
  onChange: (next: ChannelPanelDraft) => void;
}) {
  const panelChannelsQuery = useSettingsPanelChannels(true);
  const publishPanel = usePublishChannelPanel();
  const [publishError, setPublishError] = useState<string | null>(null);

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

  async function handlePublish() {
    setPublishError(null);
    try {
      await publishPanel.mutateAsync();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Failed to publish panel");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel ticket panel</CardTitle>
        <CardDescription>
          Publish a Component V2 message in a server channel or forum post so members can open
          tickets without DMing the bot first. Edit the panel in the Templates tab under{" "}
          <span className="font-medium">Channel ticket panel</span>, then publish here after saving
          changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="channel-panel-enabled" className="text-sm font-medium">
              Enable channel ticket panel
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, panel buttons open tickets and DM members the normal ticket-created
              message.
            </p>
          </div>
          <Switch
            id="channel-panel-enabled"
            checked={value.enabled}
            disabled={disabled || publishPanel.isPending}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Panel channel</Label>
          <ChannelPicker
            channels={panelChannelOptions}
            value={value.channelId ?? ""}
            disabled={disabled || panelChannelsQuery.isLoading || publishPanel.isPending}
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
                disabled={
                  disabled || forumThreadsQuery.isLoading || publishPanel.isPending
                }
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
              <p className="text-sm text-muted-foreground">
                Leave blank to create a dedicated forum post when you publish. Pick an existing
                post to host the panel message there instead.
              </p>
            </div>

            {!value.forumThreadId ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="channel-panel-forum-title">Forum post title</Label>
                <Input
                  id="channel-panel-forum-title"
                  value={value.forumPostTitle ?? ""}
                  disabled={disabled || publishPanel.isPending}
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

        {value.messageId ? (
          <p className="text-xs text-muted-foreground">
            Published message ID: {value.messageId}
            {value.forumThreadId ? ` · Forum post: ${value.forumThreadId}` : null}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={disabled || !value.channelId || publishPanel.isPending}
            onClick={handlePublish}
          >
            {publishPanel.isPending ? "Publishing…" : "Publish panel"}
          </Button>
        </div>

        {publishError ? <p className="text-sm text-destructive">{publishError}</p> : null}
      </CardContent>
    </Card>
  );
}
