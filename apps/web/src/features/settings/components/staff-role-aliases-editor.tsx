import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { StaffRoleAlias } from "../schemas/settings";

const pickerTriggerClassName = cn(
  "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors",
  "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

type GuildRole = {
  id: string;
  name: string;
};

function RolePicker({
  roles,
  value,
  disabled,
  placeholder,
  onValueChange,
}: {
  roles: GuildRole[];
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onValueChange: (roleId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedRole = roles.find((role) => role.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} className={pickerTriggerClassName}>
        <span className={cn("truncate", !selectedRole && "text-muted-foreground")}>
          {selectedRole?.name ?? placeholder ?? "Choose a role"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search roles…" />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {roles.map((role) => (
                <CommandItem
                  key={role.id}
                  value={role.name}
                  onSelect={() => {
                    onValueChange(role.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === role.id ? "opacity-100" : "opacity-0")}
                  />
                  {role.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function staffRoleAliasesEqual(
  left: StaffRoleAlias[] | undefined,
  right: StaffRoleAlias[] | undefined,
) {
  const normalize = (entries: StaffRoleAlias[] | undefined) =>
    [...(entries ?? [])].sort((a, b) => a.roleId.localeCompare(b.roleId));

  const a = normalize(left);
  const b = normalize(right);

  return (
    a.length === b.length &&
    a.every((entry, index) => {
      const other = b[index];
      return other && entry.roleId === other.roleId && entry.alias === other.alias;
    })
  );
}

export function StaffRoleAliasesEditor({
  roles,
  value,
  disabled = false,
  onChange,
}: {
  roles: GuildRole[];
  value: StaffRoleAlias[];
  disabled?: boolean;
  onChange: (next: StaffRoleAlias[]) => void;
}) {
  const usedRoleIds = useMemo(() => new Set(value.map((entry) => entry.roleId)), [value]);

  const updateEntry = (index: number, patch: Partial<StaffRoleAlias>) => {
    onChange(
      value.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const removeEntry = (index: number) => {
    onChange(value.filter((_, entryIndex) => entryIndex !== index));
  };

  const addEntry = () => {
    const nextRole = roles.find((role) => !usedRoleIds.has(role.id));
    if (!nextRole) return;

    onChange([...value, { roleId: nextRole.id, alias: nextRole.name }]);
  };

  const availableRolesForRow = (currentRoleId: string) =>
    roles.filter((role) => role.id === currentRoleId || !usedRoleIds.has(role.id));

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Staff role aliases</Label>
        <p className="text-sm text-muted-foreground">
          Map primary-server roles to labels members see in ticket DMs. With anonymous staff
          enabled, members see only the alias (for example, Developer). When anonymous staff is
          off, relays use Username (Alias).
        </p>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No role aliases configured yet.</p>
      ) : (
        <div className="space-y-3">
          {value.map((entry, index) => (
            <div
              key={`${entry.roleId}-${index}`}
              className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Discord role</Label>
                <RolePicker
                  roles={availableRolesForRow(entry.roleId)}
                  value={entry.roleId}
                  disabled={disabled}
                  onValueChange={(roleId) => updateEntry(index, { roleId })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Member-facing alias</Label>
                <Input
                  value={entry.alias}
                  disabled={disabled}
                  placeholder="Developer"
                  maxLength={64}
                  onChange={(event) => updateEntry(index, { alias: event.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label="Remove role alias"
                  onClick={() => removeEntry(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || roles.length === 0 || value.length >= roles.length}
        onClick={addEntry}
      >
        <Plus className="size-4" />
        Add role alias
      </Button>
    </div>
  );
}
