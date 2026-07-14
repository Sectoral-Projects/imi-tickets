import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUpdateWhitelabel, useWhitelabel } from "../hooks/whitelabel";
import {
  ACTIVITY_TYPE_OPTIONS,
  type UpdateWhitelabelInput,
  type WhitelabelActivityType,
} from "../schemas/whitelabel";
import { AvatarCropDialog } from "./avatar-crop-dialog";

const pickerTriggerClassName = cn(
  "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors",
  "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

type Draft = {
  nick: string;
  bio: string;
  statusText: string;
  activityType: WhitelabelActivityType;
  avatarPreviewUrl: string | null;
  avatarDataUri: string | null;
  clearAvatar: boolean;
};

function emptyDraft(): Draft {
  return {
    nick: "",
    bio: "",
    statusText: "for tickets",
    activityType: "watching",
    avatarPreviewUrl: null,
    avatarDataUri: null,
    clearAvatar: false,
  };
}

export function WhitelabelSettingsSection({ disabled = false }: { disabled?: boolean }) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [guildPickerOpen, setGuildPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const query = useWhitelabel(selectedGuildId, !disabled);
  const update = useUpdateWhitelabel();

  const guilds = query.data?.guilds ?? [];
  const profile = query.data?.profile ?? null;
  const selectedGuild =
    guilds.find((guild) => guild.id === (selectedGuildId ?? profile?.guildId)) ??
    guilds.find((guild) => guild.isPrimary) ??
    guilds[0] ??
    null;

  useEffect(() => {
    if (!query.data) return;
    const nextGuildId = query.data.profile?.guildId ?? query.data.guilds[0]?.id ?? null;
    if (!selectedGuildId && nextGuildId) {
      setSelectedGuildId(nextGuildId);
    }
  }, [query.data, selectedGuildId]);

  useEffect(() => {
    if (!query.data?.profile && !query.data?.presence) return;
    const presence = query.data.presence;
    const nextProfile = query.data.profile;
    setDraft({
      nick: nextProfile?.nick ?? "",
      bio: nextProfile?.bio ?? "",
      statusText: presence.statusText,
      activityType: presence.activityType,
      avatarPreviewUrl: nextProfile?.avatarUrl ?? nextProfile?.globalAvatarUrl ?? null,
      avatarDataUri: null,
      clearAvatar: false,
    });
    setSaveError(null);
    setSaveOk(false);
  }, [query.data?.profile?.guildId, query.data?.profile?.nick, query.data?.profile?.bio, query.data?.profile?.avatarUrl, query.data?.presence?.statusText, query.data?.presence?.activityType]);

  function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Choose an image file (PNG, JPEG, GIF, or WebP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setCropSrc(result);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!selectedGuild || disabled) return;
    setSaveError(null);
    setSaveOk(false);

    const input: UpdateWhitelabelInput = {
      guildId: selectedGuild.id,
      nick: draft.nick.trim() || null,
      bio: draft.bio.trim() || null,
      statusText: draft.statusText,
      activityType: draft.activityType,
    };

    if (draft.clearAvatar) {
      input.clearAvatar = true;
      input.avatarDataUri = null;
    } else if (draft.avatarDataUri) {
      input.avatarDataUri = draft.avatarDataUri;
    }

    try {
      await update.mutateAsync(input);
      setSaveOk(true);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to save whitelabel settings";
      setSaveError(message);
    }
  }

  if (disabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whitelabel</CardTitle>
          <CardDescription>Admin access is required to edit the bot profile.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whitelabel</CardTitle>
          <CardDescription>Loading bot profile…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (query.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whitelabel</CardTitle>
          <CardDescription className="text-destructive">
            {query.error instanceof Error ? query.error.message : "Failed to load whitelabel"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (guilds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whitelabel</CardTitle>
          <CardDescription>
            The bot is not in any Discord servers yet. Invite it first, then return here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const previewUrl = draft.avatarPreviewUrl;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Server profile</CardTitle>
          <CardDescription>
            Per-server nickname, avatar, and description for the bot. Defaults to the primary
            linked guild.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {guilds.length > 1 ? (
            <div className="space-y-2">
              <Label>Server</Label>
              <Popover open={guildPickerOpen} onOpenChange={setGuildPickerOpen}>
                <PopoverTrigger
                  disabled={update.isPending}
                  className={pickerTriggerClassName}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {selectedGuild?.iconUrl ? (
                      <img
                        src={selectedGuild.iconUrl}
                        alt=""
                        className="size-5 shrink-0 rounded-full"
                      />
                    ) : null}
                    <span className="truncate">
                      {selectedGuild?.name ?? "Choose a server"}
                      {selectedGuild?.isPrimary ? " (primary)" : ""}
                    </span>
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search servers…" />
                    <CommandList>
                      <CommandEmpty>No servers found.</CommandEmpty>
                      <CommandGroup>
                        {guilds.map((guild) => (
                          <CommandItem
                            key={guild.id}
                            value={`${guild.name} ${guild.id}`}
                            onSelect={() => {
                              setSelectedGuildId(guild.id);
                              setGuildPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "size-4",
                                selectedGuild?.id === guild.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {guild.iconUrl ? (
                              <img
                                src={guild.iconUrl}
                                alt=""
                                className="size-5 rounded-full"
                              />
                            ) : null}
                            <span className="truncate">
                              {guild.name}
                              {guild.isPrimary ? " (primary)" : ""}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Editing profile for <span className="text-foreground">{selectedGuild?.name}</span>
              {selectedGuild?.isPrimary ? " (primary)" : ""}.
            </p>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="relative size-24 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/10">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImagePlus className="size-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={update.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={update.isPending || (!previewUrl && !draft.clearAvatar)}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      avatarPreviewUrl: null,
                      avatarDataUri: null,
                      clearAvatar: true,
                    }))
                  }
                >
                  <Trash2 className="size-4" />
                  Clear
                </Button>
              </div>
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                className="sr-only"
                onChange={(event) => {
                  onPickFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>

            <div className="grid min-w-0 flex-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whitelabel-nick">Display name</Label>
                <Input
                  id="whitelabel-nick"
                  value={draft.nick}
                  maxLength={32}
                  placeholder={profile?.username ?? "Bot nickname"}
                  disabled={update.isPending}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, nick: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Per-server nickname. Leave blank to use @{profile?.username ?? "username"}.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whitelabel-bio">Description</Label>
                <Textarea
                  id="whitelabel-bio"
                  value={draft.bio}
                  maxLength={190}
                  rows={3}
                  placeholder="About this bot in this server"
                  disabled={update.isPending}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, bio: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {draft.bio.length}/190 · Per-server bio on the bot member profile.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            Global bot activity shown under the bot name. Saved here and restored after restarts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Status type</Label>
            <Select
              value={draft.activityType}
              disabled={update.isPending}
              onValueChange={(value) => {
                if (!value) return;
                setDraft((current) => ({
                  ...current,
                  activityType: value as WhitelabelActivityType,
                }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="whitelabel-status-text">Status text</Label>
            <Input
              id="whitelabel-status-text"
              value={draft.statusText}
              maxLength={128}
              disabled={update.isPending}
              onChange={(event) =>
                setDraft((current) => ({ ...current, statusText: event.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={update.isPending || !selectedGuild} onClick={handleSave}>
          {update.isPending ? "Saving…" : "Save whitelabel"}
        </Button>
        {saveOk ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
        {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
      </div>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        onOpenChange={setCropOpen}
        onConfirm={(dataUri) => {
          setDraft((current) => ({
            ...current,
            avatarDataUri: dataUri,
            avatarPreviewUrl: dataUri,
            clearAvatar: false,
          }));
        }}
      />
    </div>
  );
}
