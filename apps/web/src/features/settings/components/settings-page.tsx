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
import {
  DmWordBlacklistEditor,
  wordFilterRulesEqual,
} from "./dm-word-blacklist-editor";
import { MultiSearchableSelect } from "@/components/multi-searchable-select";
import { UnauthorizedScreen } from "@/components/unauthorized-screen";
import { ApiError } from "@/lib/api";
import type { NotifyOnNewThreadPresence } from "../schemas/settings";

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

function stringArraysEqual(left: string[] | undefined, right: string[] | undefined) {
  const a = [...(left ?? [])].sort();
  const b = [...(right ?? [])].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function SettingsContent() {
  const session = useAuthGate();
  const { data, isLoading, error } = useSettings(Boolean(session.data));
  const channelsQuery = useSettingsChannels(Boolean(data?.primaryGuildId && data?.canAdmin));
  const rolesQuery = useSettingsRoles(Boolean(data?.primaryGuildId && data?.canAdmin));
  const templatesQuery = useTemplates(Boolean(data?.canAdmin));
  const buttonsQuery = useDmOpenButtons(Boolean(data?.canAdmin));
  const channelButtonsQuery = useChannelOpenButtons(Boolean(data?.canAdmin));
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
        notifyOnNewThreadRoleIds: data.settings.notifyOnNewThreadRoleIds ?? [],
        notifyOnNewThreadPresence:
          data.settings.notifyOnNewThreadPresence ?? (["all"] as NotifyOnNewThreadPresence[]),
        commandPrefix: data.settings.commandPrefix ?? ";",
        privateMessagePrefix: data.settings.privateMessagePrefix ?? "`",
        dmWordBlacklist: data.settings.dmWordBlacklist ?? [],
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
      !stringArraysEqual(
        draft.settings.notifyOnNewThreadRoleIds,
        data.settings.notifyOnNewThreadRoleIds,
      ) ||
      !stringArraysEqual(
        draft.settings.notifyOnNewThreadPresence,
        data.settings.notifyOnNewThreadPresence ?? ["all"],
      ) ||
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
        Boolean(data.settings.useChannelNameForTranscript) ||
      (draft.settings.commandPrefix ?? ";") !== (data.settings.commandPrefix ?? ";") ||
      (draft.settings.privateMessagePrefix ?? "`") !==
        (data.settings.privateMessagePrefix ?? "`") ||
      !wordFilterRulesEqual(
        draft.settings.dmWordBlacklist,
        data.settings.dmWordBlacklist,
      )
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
    if (!draft || !data?.canAdmin) return;

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

    const commandPrefix = (draft.settings.commandPrefix ?? ";").trim();
    const privateMessagePrefix = (draft.settings.privateMessagePrefix ?? "`").trim();

    if (!commandPrefix || !privateMessagePrefix) {
      setSaveError("Command prefix and private message prefix cannot be empty.");
      return;
    }

    if (/\s/.test(commandPrefix) || /\s/.test(privateMessagePrefix)) {
      setSaveError("Prefixes cannot contain whitespace.");
      return;
    }

    if (commandPrefix.length > 5 || privateMessagePrefix.length > 5) {
      setSaveError("Prefixes must be 5 characters or fewer.");
      return;
    }

    if (commandPrefix === privateMessagePrefix) {
      setSaveError("Command prefix and private message prefix must be different.");
      return;
    }

    const dmWordBlacklist = (draft.settings.dmWordBlacklist ?? [])
      .map((rule) => ({
        term: rule.term.trim(),
        match: rule.match === "exact" ? ("exact" as const) : ("keyword" as const),
      }))
      .filter((rule) => rule.term.length > 0);

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
            notifyOnNewThreadRoleIds: draft.settings.notifyOnNewThreadRoleIds ?? [],
            notifyOnNewThreadPresence:
              draft.settings.notifyOnNewThreadPresence ?? (["all"] as NotifyOnNewThreadPresence[]),
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
            commandPrefix,
            privateMessagePrefix,
            dmWordBlacklist,
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

  if (
    error instanceof ApiError &&
    (error.code === "FORBIDDEN" || error.status === 403)
  ) {
    return (
      <UnauthorizedScreen
        title="Admin required"
        description="You need the Admin permission to view and edit settings."
      />
    );
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

  const readOnly = !data?.canAdmin;
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
            {readOnly ? <Badge variant="secondary">Admin required to edit</Badge> : null}
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
              <CardTitle>Bot prefixes</CardTitle>
              <CardDescription>
                Command prefix runs Sapphire and template staff commands. Private
                message prefix marks staff-only notes in ticket channels. They must
                differ.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="command-prefix">Command prefix</Label>
                <Input
                  id="command-prefix"
                  value={draft.settings.commandPrefix ?? ";"}
                  disabled={readOnly || updateSettings.isPending}
                  maxLength={5}
                  onChange={(event) => updateSetting("commandPrefix", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="private-message-prefix">Private message prefix</Label>
                <Input
                  id="private-message-prefix"
                  value={draft.settings.privateMessagePrefix ?? "`"}
                  disabled={readOnly || updateSettings.isPending}
                  maxLength={5}
                  onChange={(event) =>
                    updateSetting("privateMessagePrefix", event.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message filters</CardTitle>
              <CardDescription>
                Block member DMs that include restricted terms before they reach staff.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DmWordBlacklistEditor
                value={draft.settings.dmWordBlacklist ?? []}
                disabled={readOnly || updateSettings.isPending}
                onChange={(dmWordBlacklist) => updateSetting("dmWordBlacklist", dmWordBlacklist)}
              />
            </CardContent>
          </Card>

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
                description="When enabled, posts a staff-only member profile card in the ticket channel and as a System transcript row when a ticket opens or a member is added."
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
                description="Ping selected staff roles in the new ticket channel when a ticket opens."
                checked={Boolean(draft.settings.notifyOnNewThread)}
                disabled={readOnly || updateSettings.isPending}
                onCheckedChange={(checked) =>
                  updateSetting("notifyOnNewThread", checked)
                }
              />
              {draft.settings.notifyOnNewThread ? (
                <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="notify-roles">Roles to notify</Label>
                    <MultiSearchableSelect
                      options={roles.map((role) => ({
                        value: role.id,
                        label: role.name,
                        keywords: role.id,
                      }))}
                      value={draft.settings.notifyOnNewThreadRoleIds ?? []}
                      disabled={
                        readOnly ||
                        updateSettings.isPending ||
                        !data?.primaryGuildId ||
                        rolesLoading
                      }
                      placeholder={
                        !data?.primaryGuildId
                          ? "Link a primary server first"
                          : rolesLoading
                            ? "Loading roles…"
                            : "Select roles"
                      }
                      searchPlaceholder="Search roles…"
                      emptyText="No roles found."
                      onValueChange={(roleIds) =>
                        updateSetting("notifyOnNewThreadRoleIds", roleIds)
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      With All statuses, these roles are pinged directly. With a
                      presence filter, matching online members who hold any of these
                      roles are pinged individually.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="notify-presence">Presence filter</Label>
                    <MultiSearchableSelect
                      options={[
                        { value: "online", label: "Online" },
                        { value: "idle", label: "Away" },
                        { value: "dnd", label: "Do not disturb" },
                        { value: "all", label: "All statuses" },
                      ]}
                      value={
                        draft.settings.notifyOnNewThreadPresence ?? [
                          "all" as NotifyOnNewThreadPresence,
                        ]
                      }
                      disabled={readOnly || updateSettings.isPending}
                      placeholder="Select presence statuses"
                      searchPlaceholder="Search statuses…"
                      emptyText="No statuses found."
                      onValueChange={(statuses) => {
                        const next = statuses as NotifyOnNewThreadPresence[];
                        const prev = draft.settings.notifyOnNewThreadPresence ?? [
                          "all" as NotifyOnNewThreadPresence,
                        ];
                        const addedAll =
                          next.includes("all") && !prev.includes("all");
                        const selectedSpecific = next.filter(
                          (status) => status !== "all",
                        );
                        updateSetting(
                          "notifyOnNewThreadPresence",
                          addedAll
                            ? (["all"] as NotifyOnNewThreadPresence[])
                            : selectedSpecific.length > 0
                              ? selectedSpecific
                              : (["all"] as NotifyOnNewThreadPresence[]),
                        );
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      All statuses pings the selected roles. Other options ping only
                      staff currently in those Discord statuses (requires Presence +
                      Server Members intents).
                    </p>
                  </div>
                </div>
              ) : null}
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
