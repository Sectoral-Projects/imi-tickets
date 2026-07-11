import { useMemo, useState } from "react";
import { ChannelPicker } from "@/features/onboarding/components/guild-picker";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthGate, useProductAccessRedirect } from "@/lib/use-auth-gate";
import { TemplatesSettingsSection } from "@/features/templates/components/template-settings-panel";
import {
  isTemplateEditDirty,
  normalizeChannelButtons,
  normalizeDmButtons,
  serializeTemplateEdit,
  type TemplateEditDraft,
} from "@/features/templates/utils/template-edit";
import {
  useChannelOpenButtons,
  useDmOpenButtons,
  useReplaceChannelOpenButtons,
  useReplaceDmOpenButtons,
  useTemplates,
  useUpdateTemplate,
} from "@/features/templates/hooks/templates";
import { useSettings, useSettingsChannels, useSettingsRoles, useUpdateSettings } from "../hooks/settings";
import type { AppSettings, SettingsResponse } from "../schemas/settings";
import { normalizeTicketOpenButtonMode } from "@/features/templates/constants";
import { SettingsPageSkeleton } from "./settings-page-skeleton";
import { ChannelPanelSettingsSection } from "./channel-panel-settings";
import { DataPrivacySettingsSection } from "./data-privacy-settings";
import {
  StaffRoleAliasesEditor,
  staffRoleAliasesEqual,
} from "./staff-role-aliases-editor";

type SettingsDraft = {
  settings: AppSettings;
  logChannelId: string;
  transcriptChannelId: string;
  channelPanel: SettingsResponse["channelPanel"];
};

function SettingSwitchRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function SettingsContent() {
  const session = useAuthGate();
  const { data, isLoading, error } = useSettings();
  const channelsQuery = useSettingsChannels(Boolean(data?.primaryGuildId));
  const rolesQuery = useSettingsRoles(Boolean(data?.primaryGuildId));
  const templatesQuery = useTemplates();
  const buttonsQuery = useDmOpenButtons();
  const channelButtonsQuery = useChannelOpenButtons();
  const updateSettings = useUpdateSettings();
  const updateTemplate = useUpdateTemplate();
  const replaceDmOpenButtons = useReplaceDmOpenButtons();
  const replaceChannelOpenButtons = useReplaceChannelOpenButtons();
  const [draftOverride, setDraftOverride] = useState<SettingsDraft | null>(null);
  const [templateEdits, setTemplateEdits] = useState<Record<string, TemplateEditDraft>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  useProductAccessRedirect(error);

  const baseDraft = useMemo(() => {
    if (!data) return null;
    return {
      settings: {
        ...data.settings,
        ticketOpenButtonMode: normalizeTicketOpenButtonMode(data.settings.ticketOpenButtonMode),
        forwardTemplateButtonsToStaff: data.settings.forwardTemplateButtonsToStaff ?? true,
        staffRoleAliases: data.settings.staffRoleAliases ?? [],
      },
      logChannelId: data.logChannelId ?? "",
      transcriptChannelId: data.transcriptChannelId ?? "",
      channelPanel: {
        enabled: data.channelPanel.enabled,
        channelId: data.channelPanel.channelId,
        forumThreadId: data.channelPanel.forumThreadId,
        messageId: data.channelPanel.messageId,
        forumPostTitle: data.channelPanel.forumPostTitle,
      },
    };
  }, [data]);

  const draft = draftOverride ?? baseDraft;

  const serverDmButtons = useMemo(
    () =>
      (buttonsQuery.data?.buttons ?? []).map((button) => ({
        id: button.id,
        label: button.label,
        actionType: button.actionType ?? "message",
        templateId: button.templateId,
        modalTemplateId: button.modalTemplateId,
        optionalTag: button.optionalTag ?? "",
        enabled: button.enabled,
      })),
    [buttonsQuery.data?.buttons],
  );

  const serverChannelOpenButtons = useMemo(
    () =>
      (channelButtonsQuery.data?.buttons ?? []).map((button) => ({
        id: button.id,
        label: button.label,
        actionType: button.actionType ?? "message",
        templateId: button.templateId,
        modalTemplateId: button.modalTemplateId,
        optionalTag: button.optionalTag ?? "",
        subjectTemplate: button.subjectTemplate ?? "",
        enabled: button.enabled,
      })),
    [channelButtonsQuery.data?.buttons],
  );

  const autoCloseEnabled = Boolean(
    draft?.settings.closeAfterMinutes && draft.settings.closeAfterMinutes > 0,
  );

  const generalDirty = useMemo(() => {
    if (!draft || !data) return false;

    return (
      draft.logChannelId !== (data.logChannelId ?? "") ||
      draft.transcriptChannelId !== (data.transcriptChannelId ?? "") ||
      draft.channelPanel.enabled !== data.channelPanel.enabled ||
      (draft.channelPanel.channelId ?? "") !== (data.channelPanel.channelId ?? "") ||
      (draft.channelPanel.forumThreadId ?? "") !== (data.channelPanel.forumThreadId ?? "") ||
      (draft.channelPanel.forumPostTitle ?? "") !== (data.channelPanel.forumPostTitle ?? "") ||
      draft.settings.relayStaffTypingToMember !==
        Boolean(data.settings.relayStaffTypingToMember) ||
      draft.settings.anonymousStaff !== Boolean(data.settings.anonymousStaff) ||
      !staffRoleAliasesEqual(
        draft.settings.staffRoleAliases,
        data.settings.staffRoleAliases,
      ) ||
      draft.settings.autoTagClosedThreads !==
        Boolean(data.settings.autoTagClosedThreads) ||
      draft.settings.notifyOnNewThread !==
        Boolean(data.settings.notifyOnNewThread) ||
      (draft.settings.closeAfterMinutes ?? null) !==
        (data.settings.closeAfterMinutes ?? null) ||
      (draft.settings.autoCloseReminderMinutes ?? null) !==
        (data.settings.autoCloseReminderMinutes ?? null) ||
      (draft.settings.ticketOpenButtonMode ?? "off") !==
        normalizeTicketOpenButtonMode(data.settings.ticketOpenButtonMode) ||
      (draft.settings.staffTicketOpenProfile ?? true) !==
        (data.settings.staffTicketOpenProfile ?? true) ||
      (draft.settings.forwardTemplateButtonsToStaff ?? true) !==
        (data.settings.forwardTemplateButtonsToStaff ?? true) ||
      (draft.settings.ticketChannelNameTemplate ?? "") !==
        (data.settings.ticketChannelNameTemplate ?? "") ||
      Boolean(draft.settings.useChannelNameForTranscript) !==
        Boolean(data.settings.useChannelNameForTranscript)
    );
  }, [data, draft]);

  const templatesDirty = useMemo(() => {
    const templates = templatesQuery.data?.templates ?? [];
    return Object.entries(templateEdits).some(([id, edit]) => {
      const template = templates.find((item) => item.id === id);
      return template
        ? isTemplateEditDirty(template, edit, serverDmButtons, serverChannelOpenButtons)
        : false;
    });
  }, [templateEdits, templatesQuery.data?.templates, serverDmButtons, serverChannelOpenButtons]);

  const isDirty = generalDirty || templatesDirty;

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setDraftOverride((current) =>
      current ?? baseDraft
        ? {
            ...(current ?? baseDraft!),
            settings: {
              ...(current ?? baseDraft!).settings,
              [key]: value,
            },
          }
        : null,
    );
  };

  const handleTemplateEditChange = (id: string, edit: TemplateEditDraft | null) => {
    setTemplateEdits((current) => {
      if (!edit) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: edit };
    });
  };

  const handleSave = async () => {
    if (!draft || !data?.canManage) return;

    setSaveError(null);

    const closeAfterMinutes = draft.settings.closeAfterMinutes;
    const autoCloseReminderMinutes = draft.settings.autoCloseReminderMinutes;

    if (
      closeAfterMinutes !== undefined &&
      (!Number.isFinite(closeAfterMinutes) || closeAfterMinutes <= 0)
    ) {
      setSaveError("Auto-close minutes must be a positive number.");
      return;
    }

    if (
      autoCloseReminderMinutes !== undefined
    ) {
      if (!Number.isFinite(autoCloseReminderMinutes) || autoCloseReminderMinutes <= 0) {
        setSaveError("Reminder minutes must be a positive number.");
        return;
      }

      if (!closeAfterMinutes || autoCloseReminderMinutes >= closeAfterMinutes) {
        setSaveError("Reminder minutes must be less than auto-close minutes.");
        return;
      }
    }

    const aliases = draft.settings.staffRoleAliases ?? [];
    const seenRoleIds = new Set<string>();

    for (const entry of aliases) {
      const roleId = entry.roleId.trim();
      const alias = entry.alias.trim();

      if (!roleId) {
        setSaveError("Each role alias must include a Discord role.");
        return;
      }

      if (!alias) {
        setSaveError("Each role alias must include a member-facing label.");
        return;
      }

      if (alias.length > 64) {
        setSaveError("Role aliases must be 64 characters or fewer.");
        return;
      }

      if (seenRoleIds.has(roleId)) {
        setSaveError("Each role can only have one alias.");
        return;
      }

      seenRoleIds.add(roleId);
    }

    try {
      if (generalDirty) {
        await updateSettings.mutateAsync({
          settings: {
            relayStaffTypingToMember: draft.settings.relayStaffTypingToMember,
            anonymousStaff: draft.settings.anonymousStaff,
            staffRoleAliases: aliases.map((entry) => ({
              roleId: entry.roleId.trim(),
              alias: entry.alias.trim(),
            })),
            autoTagClosedThreads: draft.settings.autoTagClosedThreads,
            notifyOnNewThread: draft.settings.notifyOnNewThread,
            closeAfterMinutes: draft.settings.closeAfterMinutes ?? null,
            autoCloseReminderMinutes: autoCloseEnabled
              ? (draft.settings.autoCloseReminderMinutes ?? null)
              : null,
            ticketOpenButtonMode: normalizeTicketOpenButtonMode(
              draft.settings.ticketOpenButtonMode,
            ),
            staffTicketOpenProfile: draft.settings.staffTicketOpenProfile ?? true,
            forwardTemplateButtonsToStaff:
              draft.settings.forwardTemplateButtonsToStaff ?? true,
            ticketChannelNameTemplate:
              draft.settings.ticketChannelNameTemplate?.trim() || null,
            useChannelNameForTranscript:
              draft.settings.useChannelNameForTranscript ?? false,
          },
          logChannelId: draft.logChannelId.trim() || null,
          transcriptChannelId: draft.transcriptChannelId.trim() || null,
          channelPanel: {
            enabled: draft.channelPanel.enabled,
            channelId: draft.channelPanel.channelId,
            forumThreadId: draft.channelPanel.forumThreadId,
            forumPostTitle: draft.channelPanel.forumPostTitle,
          },
        });
        setDraftOverride(null);
      }

      const templates = templatesQuery.data?.templates ?? [];
      for (const [id, edit] of Object.entries(templateEdits)) {
        const template = templates.find((item) => item.id === id);
        if (
          !template ||
          !isTemplateEditDirty(template, edit, serverDmButtons, serverChannelOpenButtons)
        )
          continue;

        const payload = serializeTemplateEdit(edit, id);
        const staffCommand = payload.staffCommand?.trim() ?? "";
        if (staffCommand && !/^[a-z][a-z0-9_-]{0,31}$/i.test(staffCommand)) {
          setSaveError(
            "Template command names must be 1-32 characters and use letters, numbers, underscore, or dash.",
          );
          return;
        }

        await updateTemplate.mutateAsync({
          id,
          input: {
            name: template.name,
            description: template.description,
            category: payload.category ?? template.category,
            template: payload.template,
            enabled: payload.enabled,
            staffCommand: payload.staffCommand ?? null,
            buttonActions: payload.buttonActions ?? null,
          },
        });

        if (payload.dmButtons) {
          await replaceDmOpenButtons.mutateAsync(normalizeDmButtons(payload.dmButtons));
        }

        if (payload.channelButtons) {
          await replaceChannelOpenButtons.mutateAsync(
            normalizeChannelButtons(payload.channelButtons),
          );
        }
      }
      setTemplateEdits({});
    } catch (saveFailure) {
      setSaveError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Failed to save settings.",
      );
    }
  };

  if (session.isPending || !session.data) {
    return <SettingsPageSkeleton />;
  }

  if (isLoading || !draft) {
    return <SettingsPageSkeleton />;
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground">
        Error: {error.message}
      </div>
    );
  }

  const readOnly = !data?.canManage;
  const adminOnly = !data?.canAdmin;
  const channels = channelsQuery.data?.channels ?? [];
  const channelsLoading = channelsQuery.isLoading;
  const channelsUnavailable = !data?.primaryGuildId;
  const roles = rolesQuery.data?.roles ?? [];
  const rolesLoading = rolesQuery.isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-3xl shrink-0 space-y-4 px-4 pt-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure privacy, ticket behavior, and message templates.
              </p>
            </div>
            {readOnly ? <Badge variant="secondary">Read only</Badge> : null}
          </div>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            {data?.canAdmin ? (
              <TabsTrigger value="data-privacy">Data &amp; privacy</TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="overscroll-behavior-contain [overflow-anchor:none]"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-4 sm:px-6">
        <TabsContent value="general" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
              <CardDescription>
                Control what members see when staff interact with tickets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingSwitchRow
                id="relay-staff-typing"
                label="Show staff typing in member DMs"
                description="When enabled, members see a typing indicator while staff compose replies in the ticket channel."
                checked={Boolean(draft.settings.relayStaffTypingToMember)}
                disabled={readOnly || updateSettings.isPending}
                onCheckedChange={(checked) =>
                  updateSetting("relayStaffTypingToMember", checked)
                }
              />
              <Separator />
              <SettingSwitchRow
                id="anonymous-staff"
                label="Anonymous staff replies"
                description="When enabled, staff usernames are hidden from relay messages sent to members. Unmatched staff still appear as Staff unless a role alias applies."
                checked={Boolean(draft.settings.anonymousStaff)}
                disabled={readOnly || updateSettings.isPending}
                onCheckedChange={(checked) =>
                  updateSetting("anonymousStaff", checked)
                }
              />
              <Separator />
              {channelsUnavailable ? (
                <p className="text-sm text-muted-foreground">
                  Link a primary server during onboarding to configure staff role aliases.
                </p>
              ) : rolesLoading ? (
                <p className="text-sm text-muted-foreground">Loading roles…</p>
              ) : (
                <StaffRoleAliasesEditor
                  roles={roles}
                  value={draft.settings.staffRoleAliases ?? []}
                  disabled={readOnly || updateSettings.isPending}
                  onChange={(staffRoleAliases) => updateSetting("staffRoleAliases", staffRoleAliases)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
              <CardDescription>
                Automation and notification defaults for new and closed tickets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="ticket-channel-name-template">
                  Channel / post name template
                </Label>
                <Input
                  id="ticket-channel-name-template"
                  placeholder="#{{ticketId}} - {{username}}"
                  value={draft.settings.ticketChannelNameTemplate ?? ""}
                  disabled={readOnly || updateSettings.isPending}
                  onChange={(event) =>
                    updateSetting(
                      "ticketChannelNameTemplate",
                      event.target.value.trim() ? event.target.value : null,
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Mustache template used when a ticket channel or forum post is
                  created. Leave blank for the default format. Variables:{" "}
                  <code className="text-foreground">{"{{ticketId}}"}</code>,{" "}
                  <code className="text-foreground">{"{{username}}"}</code>,{" "}
                  <code className="text-foreground">{"{{usernameSlug}}"}</code>,{" "}
                  <code className="text-foreground">{"{{random}}"}</code>.
                </p>
              </div>
              <SettingSwitchRow
                id="use-channel-name-for-transcript"
                label="Use channel name for transcript title"
                description="Tickets on the site show the Discord channel or forum post name instead of the ticket subject. Updates when staff rename the ticket."
                checked={Boolean(draft.settings.useChannelNameForTranscript)}
                disabled={readOnly || updateSettings.isPending}
                onCheckedChange={(checked) =>
                  updateSetting("useChannelNameForTranscript", checked)
                }
              />
              <Separator />
              <SettingSwitchRow
                id="staff-ticket-open-profile"
                label="Show member profile on ticket open"
                description="Send a staff-only Component V2 summary before the member's first message in new ticket channels or posts."
                checked={draft.settings.staffTicketOpenProfile ?? true}
                disabled={readOnly || updateSettings.isPending}
                onCheckedChange={(checked) =>
                  updateSetting("staffTicketOpenProfile", checked)
                }
              />
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="close-after-minutes">
                  Auto-close after inactivity (minutes)
                </Label>
                <Input
                  id="close-after-minutes"
                  type="number"
                  min={1}
                  placeholder="Disabled"
                  value={draft.settings.closeAfterMinutes ?? ""}
                  disabled={readOnly || updateSettings.isPending}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "") {
                      setDraftOverride((current) =>
                        current ?? baseDraft
                          ? {
                              ...(current ?? baseDraft!),
                              settings: {
                                ...(current ?? baseDraft!).settings,
                                closeAfterMinutes: undefined,
                                autoCloseReminderMinutes: undefined,
                              },
                            }
                          : null,
                      );
                      return;
                    }

                    updateSetting("closeAfterMinutes", Number(value));
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Closes open tickets after this many minutes with no new messages.
                  Leave blank to disable.
                </p>
              </div>

              {autoCloseEnabled ? (
                <div className="space-y-2">
                  <Label htmlFor="auto-close-reminder-minutes">
                    Remind before auto-close (minutes)
                  </Label>
                  <Input
                    id="auto-close-reminder-minutes"
                    type="number"
                    min={1}
                    max={(draft.settings.closeAfterMinutes ?? 1) - 1}
                    placeholder="No reminder"
                    value={draft.settings.autoCloseReminderMinutes ?? ""}
                    disabled={readOnly || updateSettings.isPending}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateSetting(
                        "autoCloseReminderMinutes",
                        value === "" ? undefined : Number(value),
                      );
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Sends a reminder DM this many minutes before auto-close. Reminders
                    do not count as new activity.
                  </p>
                </div>
              ) : null}

              <Separator />
              <SettingSwitchRow
                id="auto-tag-closed"
                label="Auto-tag closed tickets"
                description="Automatically apply a closed tag when tickets are closed."
                checked={Boolean(draft.settings.autoTagClosedThreads)}
                disabled={readOnly || updateSettings.isPending}
                onCheckedChange={(checked) =>
                  updateSetting("autoTagClosedThreads", checked)
                }
              />
              <Separator />
              <SettingSwitchRow
                id="notify-new-thread"
                label="Notify on new tickets"
                description="Send a notification when a new ticket is opened."
                checked={Boolean(draft.settings.notifyOnNewThread)}
                disabled={readOnly || updateSettings.isPending}
                onCheckedChange={(checked) =>
                  updateSetting("notifyOnNewThread", checked)
                }
              />
            </CardContent>
          </Card>

          <ChannelPanelSettingsSection
            value={draft.channelPanel}
            disabled={readOnly || updateSettings.isPending}
            onChange={(channelPanel) =>
              setDraftOverride((current) =>
                current ?? baseDraft
                  ? {
                      ...(current ?? baseDraft!),
                      channelPanel,
                    }
                  : null,
              )
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>Discord channels</CardTitle>
              <CardDescription>
                Optional log and transcript destinations in your linked server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {channelsUnavailable ? (
                <p className="text-sm text-muted-foreground">
                  Link a primary server during onboarding to choose channels here.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Log channel</Label>
                    <ChannelPicker
                      channels={channels}
                      value={draft.logChannelId}
                      disabled={readOnly || updateSettings.isPending || channelsLoading}
                      placeholder={channelsLoading ? "Loading channels…" : "Choose a channel"}
                      searchPlaceholder="Search channels…"
                      emptyMessage="No text channels found."
                      noneLabel="No channel"
                      onValueChange={(channelId) =>
                        setDraftOverride((current) =>
                          current
                            ? { ...current, logChannelId: channelId }
                            : baseDraft
                              ? { ...baseDraft, logChannelId: channelId }
                              : null,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Transcript channel</Label>
                    <ChannelPicker
                      channels={channels}
                      value={draft.transcriptChannelId}
                      disabled={readOnly || updateSettings.isPending || channelsLoading}
                      placeholder={channelsLoading ? "Loading channels…" : "Choose a channel"}
                      searchPlaceholder="Search channels…"
                      emptyMessage="No text channels found."
                      noneLabel="No channel"
                      onValueChange={(channelId) =>
                        setDraftOverride((current) =>
                          current
                            ? { ...current, transcriptChannelId: channelId }
                            : baseDraft
                              ? { ...baseDraft, transcriptChannelId: channelId }
                              : null,
                        )
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesSettingsSection
            canManage={!readOnly}
            selectedId={selectedTemplateId}
            onSelectedIdChange={setSelectedTemplateId}
            templateEdits={templateEdits}
            onTemplateEditChange={handleTemplateEditChange}
            serverDmButtons={serverDmButtons}
            serverChannelOpenButtons={serverChannelOpenButtons}
            ticketOpenButtonMode={normalizeTicketOpenButtonMode(
              draft.settings.ticketOpenButtonMode,
            )}
            onTicketOpenButtonModeChange={(mode) =>
              updateSetting("ticketOpenButtonMode", mode)
            }
            forwardTemplateButtonsToStaff={
              draft.settings.forwardTemplateButtonsToStaff ?? true
            }
            onForwardTemplateButtonsToStaffChange={(enabled) =>
              updateSetting("forwardTemplateButtonsToStaff", enabled)
            }
          />
        </TabsContent>

        {data?.canAdmin ? (
          <TabsContent value="data-privacy">
            <DataPrivacySettingsSection disabled={adminOnly} />
          </TabsContent>
        ) : null}

          </div>
        </ScrollArea>

        {saveError || !readOnly ? (
          <div className="mx-auto w-full max-w-3xl shrink-0 space-y-3 border-t border-border px-4 py-4 sm:px-6">
            {saveError ? (
              <p className="text-sm text-destructive">{saveError}</p>
            ) : null}

            {!readOnly ? (
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={
                    !isDirty ||
                    updateSettings.isPending ||
                    updateTemplate.isPending ||
                    replaceDmOpenButtons.isPending ||
                    replaceChannelOpenButtons.isPending
                  }
                >
                  {updateSettings.isPending ||
                  updateTemplate.isPending ||
                  replaceDmOpenButtons.isPending ||
                  replaceChannelOpenButtons.isPending
                    ? "Saving..."
                    : "Save changes"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Tabs>
    </div>
  );
}
