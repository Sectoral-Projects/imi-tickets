import { useState } from "react";
import { Check, ChevronsUpDown, CircleOff, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DiscordSetupGuild, SetupPermission } from "../schemas/setup";

const pickerTriggerClassName = cn(
  "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors",
  "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

interface GuildPickerProps {
  guilds: DiscordSetupGuild[];
  value: string;
  onValueChange: (guildId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function GuildPicker({
  guilds,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Choose a server",
}: GuildPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedGuild = guilds.find((guild) => guild.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} className={pickerTriggerClassName}>
        <span className={cn("truncate", !selectedGuild && "text-muted-foreground")}>
          {selectedGuild?.name ?? placeholder}
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
                  value={guild.name}
                  onSelect={() => {
                    onValueChange(guild.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === guild.id ? "opacity-100" : "opacity-0")}
                  />
                  {guild.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface GuildMultiPickerProps {
  guilds: DiscordSetupGuild[];
  selectedGuildIds: Set<string>;
  onSelectedGuildIdsChange: (guildIds: Set<string>) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function GuildMultiPicker({
  guilds,
  selectedGuildIds,
  onSelectedGuildIdsChange,
  disabled = false,
  placeholder = "Choose servers",
}: GuildMultiPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedCount = selectedGuildIds.size;
  const summary =
    selectedCount === 0
      ? placeholder
      : selectedCount === 1
        ? guilds.find((guild) => selectedGuildIds.has(guild.id))?.name ?? "1 server selected"
        : `${selectedCount} servers selected`;

  function toggleGuild(guildId: string) {
    const next = new Set(selectedGuildIds);
    if (next.has(guildId)) next.delete(guildId);
    else next.add(guildId);
    onSelectedGuildIdsChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} className={pickerTriggerClassName}>
        <span className={cn("truncate", selectedCount === 0 && "text-muted-foreground")}>
          {summary}
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
                  value={guild.name}
                  onSelect={() => toggleGuild(guild.id)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      selectedGuildIds.has(guild.id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {guild.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ChannelPickerProps {
  channels: Array<{ id: string; name: string }>;
  value: string;
  onValueChange: (channelId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noneLabel?: string;
}

export function ChannelPicker({
  channels,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Choose a channel",
  searchPlaceholder = "Search channels…",
  emptyMessage = "No channels found.",
  noneLabel,
}: ChannelPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedChannel = channels.find((channel) => channel.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} className={pickerTriggerClassName}>
        <span className={cn("truncate", !selectedChannel && "text-muted-foreground")}>
          {selectedChannel?.name ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {noneLabel ? (
                <CommandItem
                  value={noneLabel}
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === "" ? "opacity-100" : "opacity-0")} />
                  {noneLabel}
                </CommandItem>
              ) : null}
              {channels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={channel.name}
                  onSelect={() => {
                    onValueChange(channel.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === channel.id ? "opacity-100" : "opacity-0")}
                  />
                  {channel.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface StaffRolePermissionsEditorProps {
  roles: Array<{ id: string; name: string }>;
  rolePermissions: Record<string, SetupPermission[]>;
  onPermissionLevelChange: (roleId: string, level: StaffPermissionLevel) => void;
  disabled?: boolean;
  placeholder?: string;
}

export type StaffPermissionLevel = "none" | "read" | "manage" | "admin";

const permissionColumnsClassName =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3";

export function permissionsToStaffLevel(permissions: SetupPermission[]): StaffPermissionLevel {
  if (permissions.includes("ADMIN")) return "admin";
  if (permissions.includes("MANAGE")) return "manage";
  if (permissions.includes("READ")) return "read";
  return "none";
}

export function staffLevelToPermissions(level: StaffPermissionLevel): SetupPermission[] {
  if (level === "admin") return ["READ", "MANAGE", "ADMIN"];
  if (level === "manage") return ["READ", "MANAGE"];
  if (level === "read") return ["READ"];
  return [];
}

export function StaffRolePermissionsEditor({
  roles,
  rolePermissions,
  onPermissionLevelChange,
  disabled = false,
  placeholder = "Configure staff roles",
}: StaffRolePermissionsEditorProps) {
  const [open, setOpen] = useState(false);
  const staffRoles = roles.filter(
    (role) => permissionsToStaffLevel(rolePermissions[role.id] ?? []) !== "none",
  );
  const summary =
    staffRoles.length === 0
      ? placeholder
      : staffRoles.length === 1
        ? staffRoles[0]!.name
        : `${staffRoles.length} staff roles`;

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger disabled={disabled} className={pickerTriggerClassName}>
          <span className={cn("truncate", staffRoles.length === 0 && "text-muted-foreground")}>
            {summary}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search roles…" />
            <div
              className={cn(
                permissionColumnsClassName,
                "border-b border-border py-2.5 text-xs font-medium text-muted-foreground",
              )}
            >
              <span>Role</span>
              <span className="text-center">Access</span>
            </div>
            <CommandList className="max-h-72">
              <CommandEmpty>No roles found.</CommandEmpty>
              <CommandGroup className="p-0">
                {roles.map((role) => {
                  const level = permissionsToStaffLevel(rolePermissions[role.id] ?? []);

                  return (
                    <CommandItem
                      key={role.id}
                      value={role.name}
                      onSelect={() => undefined}
                      className={cn(
                        permissionColumnsClassName,
                        "gap-0 rounded-none py-2.5 aria-selected:bg-transparent data-[selected=true]:bg-transparent",
                        "[&>svg.ms-auto]:hidden",
                      )}
                    >
                      <span className="truncate font-medium">{role.name}</span>
                      <StaffPermissionLevelSwitch
                        level={level}
                        onLevelChange={(nextLevel) =>
                          onPermissionLevelChange(role.id, nextLevel)
                        }
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {staffRoles.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {staffRoles.length} role{staffRoles.length === 1 ? "" : "s"} with ticket access. At least
          one needs read access.
        </p>
      ) : null}
    </div>
  );
}

const staffPermissionOptions = [
  { value: "none", label: "None", icon: CircleOff },
  { value: "read", label: "Read", icon: Eye },
  { value: "manage", label: "Manage", icon: ShieldCheck },
  { value: "admin", label: "Admin", icon: ShieldAlert },
] as const satisfies ReadonlyArray<{
  value: StaffPermissionLevel;
  label: string;
  icon: typeof CircleOff;
}>;

function StaffPermissionLevelSwitch({
  level,
  onLevelChange,
}: {
  level: StaffPermissionLevel;
  onLevelChange: (level: StaffPermissionLevel) => void;
}) {
  return (
    <ToggleGroup
      value={[level]}
      onValueChange={(values) => {
        const next = values.at(-1) as StaffPermissionLevel | undefined;
        if (next) onLevelChange(next);
      }}
      spacing={0}
      variant="outline"
      size="sm"
      className="shrink-0"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {staffPermissionOptions.map((option) => {
        const Icon = option.icon;

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger
              delay={200}
              render={
                <ToggleGroupItem
                  value={option.value}
                  aria-label={option.label}
                  className="min-w-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                >
                  <Icon />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">{option.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
