import { useEffect, useState } from "react";
import {
  ChannelPicker,
  StaffRolePermissionsEditor,
  staffLevelToPermissions,
  type StaffPermissionLevel,
} from "@/features/onboarding/components/guild-picker";
import {
  useRefreshSetupGuilds,
  useSaveChannelStrategy,
  useSaveRolePermissions,
  useSaveSetupGuilds,
  useSetupGuilds,
  useSetupResources,
  useSetupStatus,
} from "@/features/onboarding/hooks/setup";
import type {
  ChannelStrategy,
  LinkedGuildStatus,
  SetupPermission,
} from "@/features/onboarding/schemas/setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function rolePermissionsRecord(
  guild: LinkedGuildStatus,
): Record<string, SetupPermission[]> {
  const next: Record<string, SetupPermission[]> = {};
  for (const role of guild.rolePermissions) {
    next[role.roleId] = role.permissions;
  }
  return next;
}

function setStaffPermissionLevel(
  current: Record<string, SetupPermission[]>,
  roleId: string,
  level: StaffPermissionLevel,
) {
  return { ...current, [roleId]: staffLevelToPermissions(level) };
}

function GuildRoutingEditor({
  guild,
  disabled,
}: {
  guild: LinkedGuildStatus;
  disabled?: boolean;
}) {
  const resources = useSetupResources(guild.guildId, true);
  const saveChannelStrategy = useSaveChannelStrategy();
  const [strategy, setStrategy] = useState<ChannelStrategy>(
    (guild.channelStrategy as ChannelStrategy | null) ?? "category",
  );
  const [channelId, setChannelId] = useState(
    guild.categoryChannelId ?? guild.forumChannelId ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStrategy((guild.channelStrategy as ChannelStrategy | null) ?? "category");
    setChannelId(guild.categoryChannelId ?? guild.forumChannelId ?? "");
  }, [guild]);

  const channelOptions =
    strategy === "category"
      ? (resources.data?.categories ?? [])
      : (resources.data?.forums ?? []);

  const savedChannelId =
    guild.channelStrategy === "forum"
      ? (guild.forumChannelId ?? "")
      : (guild.categoryChannelId ?? "");
  const dirty =
    strategy !== ((guild.channelStrategy as ChannelStrategy | null) ?? "category") ||
    channelId !== savedChannelId;

  async function handleSave() {
    setError(null);
    if (!channelId) {
      setError("Choose a channel before saving routing.");
      return;
    }
    try {
      await saveChannelStrategy.mutateAsync({
        guildId: guild.guildId,
        strategy,
        channelId,
      });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Ticket routing</Label>
        <p className="text-sm text-muted-foreground">
          Where new tickets are created in this server.
        </p>
      </div>

      {resources.isFetching ? (
        <p className="text-sm text-muted-foreground">Loading channels…</p>
      ) : resources.error ? (
        <p className="text-sm text-destructive">{errorMessage(resources.error)}</p>
      ) : (
        <>
          <RadioGroup
            value={strategy}
            onValueChange={(value) => {
              if (!value) return;
              setStrategy(value as ChannelStrategy);
              setChannelId("");
            }}
            className="grid gap-3 sm:grid-cols-2"
            disabled={disabled || saveChannelStrategy.isPending}
          >
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border border-border p-4 transition-colors",
                strategy === "category" && "border-primary bg-muted/40",
              )}
            >
              <RadioGroupItem value="category" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">Category</span>
                <span className="text-sm text-muted-foreground">
                  New ticket channels under a category.
                </span>
              </div>
            </label>
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border border-border p-4 transition-colors",
                strategy === "forum" && "border-primary bg-muted/40",
              )}
            >
              <RadioGroupItem value="forum" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">Forum channel</span>
                <span className="text-sm text-muted-foreground">
                  Tickets as posts in a forum.
                </span>
              </div>
            </label>
          </RadioGroup>

          <ChannelPicker
            channels={channelOptions}
            value={channelId}
            disabled={disabled || saveChannelStrategy.isPending}
            onValueChange={setChannelId}
            placeholder={
              strategy === "category" ? "Select a category" : "Select a forum channel"
            }
            searchPlaceholder={
              strategy === "category" ? "Search categories…" : "Search forum channels…"
            }
            emptyMessage={
              strategy === "category" ? "No categories found." : "No forum channels found."
            }
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || !dirty || !channelId || saveChannelStrategy.isPending}
          onClick={() => void handleSave()}
        >
          {saveChannelStrategy.isPending ? "Saving…" : "Save routing"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

function GuildStaffRolesEditor({
  guild,
  disabled,
}: {
  guild: LinkedGuildStatus;
  disabled?: boolean;
}) {
  const resources = useSetupResources(guild.guildId, true);
  const saveRolePermissions = useSaveRolePermissions();
  const [rolePermissions, setRolePermissions] = useState(() =>
    rolePermissionsRecord(guild),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRolePermissions(rolePermissionsRecord(guild));
  }, [guild]);

  const roles = resources.data?.roles ?? [];
  const savedKey = JSON.stringify(rolePermissionsRecord(guild));
  const draftKey = JSON.stringify(rolePermissions);
  const dirty = savedKey !== draftKey;

  async function handleSave() {
    setError(null);
    const rolesPayload = Object.entries(rolePermissions)
      .filter(([, permissions]) => permissions.length > 0)
      .map(([roleId, permissions]) => ({ roleId, permissions }));

    try {
      await saveRolePermissions.mutateAsync({
        guildId: guild.guildId,
        roles: rolesPayload,
      });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Staff roles</Label>
        <p className="text-sm text-muted-foreground">
          Which Discord roles can read, manage, or administer tickets.
        </p>
      </div>

      {resources.isFetching ? (
        <p className="text-sm text-muted-foreground">Loading roles…</p>
      ) : resources.error ? (
        <p className="text-sm text-destructive">{errorMessage(resources.error)}</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignable roles found.</p>
      ) : (
        <StaffRolePermissionsEditor
          roles={roles}
          rolePermissions={rolePermissions}
          disabled={disabled || saveRolePermissions.isPending}
          onPermissionLevelChange={(roleId, level) =>
            setRolePermissions((current) =>
              setStaffPermissionLevel(current, roleId, level),
            )
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || !dirty || saveRolePermissions.isPending}
          onClick={() => void handleSave()}
        >
          {saveRolePermissions.isPending ? "Saving…" : "Save staff roles"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

export function ServersSettingsSection({ disabled = false }: { disabled?: boolean }) {
  const setupStatus = useSetupStatus(true);
  const setupGuilds = useSetupGuilds(true);
  const saveGuilds = useSaveSetupGuilds();
  const refreshSetupGuilds = useRefreshSetupGuilds();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [prunedExtras, setPrunedExtras] = useState(false);

  const linkedGuilds = setupStatus.data?.linkedGuilds ?? [];
  const primaryGuildId = setupStatus.data?.primaryGuildId ?? "";
  const primaryGuild =
    linkedGuilds.find((guild) => guild.isPrimary) ?? linkedGuilds[0] ?? null;
  const availableGuilds = setupGuilds.data?.guilds ?? [];
  const hasLegacyExtras = linkedGuilds.some((guild) => !guild.isPrimary);

  // One-shot prune of legacy non-primary linked guilds.
  useEffect(() => {
    if (prunedExtras || disabled || !primaryGuildId || !hasLegacyExtras) return;
    if (saveGuilds.isPending) return;
    setPrunedExtras(true);
    void saveGuilds.mutateAsync({
      primaryGuildId,
      additionalGuildIds: [],
    });
  }, [
    disabled,
    hasLegacyExtras,
    primaryGuildId,
    prunedExtras,
    saveGuilds,
  ]);

  if (setupStatus.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Servers</CardTitle>
          <CardDescription>Loading linked servers…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (setupStatus.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Servers</CardTitle>
          <CardDescription className="text-destructive">
            {errorMessage(setupStatus.error)}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const primaryPresence = availableGuilds.find((guild) => guild.id === primaryGuildId);
  const botReady = Boolean(primaryPresence?.botPresent);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Primary server</CardTitle>
          <CardDescription>
            Tickets and staff access are configured for this Discord server. Other servers where
            the bot is present are recognized automatically (for example mutual servers and role
            blocks) without being linked here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border px-4 py-3 text-sm">
            <div className="font-medium">
              {primaryGuild?.name ?? (primaryGuildId || "Not configured")}
            </div>
            {primaryGuildId ? (
              <div className="text-muted-foreground">ID: {primaryGuildId}</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bot presence</CardTitle>
          <CardDescription>
            Confirm the bot is in the primary server. Invite if needed, then recheck.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm">
            <div>
              <div className="font-medium">
                {primaryGuild?.name ?? (primaryGuildId || "Primary server")}
              </div>
              <div className="text-muted-foreground">
                {botReady ? "Bot connected" : "Invite required"}
              </div>
            </div>
            {botReady ? (
              <Badge variant="secondary">Ready</Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || !primaryPresence?.inviteUrl}
                onClick={() =>
                  primaryPresence?.inviteUrl &&
                  window.open(primaryPresence.inviteUrl, "_blank", "noreferrer")
                }
              >
                Invite
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={disabled || isRefreshing}
            onClick={() => {
              setIsRefreshing(true);
              void refreshSetupGuilds().finally(() => setIsRefreshing(false));
            }}
          >
            {isRefreshing ? "Rechecking…" : "Recheck bot presence"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routing &amp; staff</CardTitle>
          <CardDescription>
            Configure ticket channel strategy and staff role access for the primary server.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          {!primaryGuild ? (
            <p className="text-sm text-muted-foreground">No primary server configured yet.</p>
          ) : (
            <>
              <GuildRoutingEditor guild={primaryGuild} disabled={disabled} />
              <GuildStaffRolesEditor guild={primaryGuild} disabled={disabled} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
