import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Extra text included in Command filtering (e.g. ids). */
  keywords?: string;
  /** Optional CommandGroup heading. Ungrouped options render first. */
  group?: string;
};

const triggerClassName = cn(
  "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors",
  "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

type OptionGroup = {
  heading: string | null;
  options: SearchableSelectOption[];
};

function groupOptions(options: SearchableSelectOption[]): OptionGroup[] {
  const ungrouped: SearchableSelectOption[] = [];
  const byHeading = new Map<string, SearchableSelectOption[]>();
  const headingOrder: string[] = [];

  for (const option of options) {
    const heading = option.group?.trim() || null;
    if (!heading) {
      ungrouped.push(option);
      continue;
    }
    if (!byHeading.has(heading)) {
      byHeading.set(heading, []);
      headingOrder.push(heading);
    }
    byHeading.get(heading)!.push(option);
  }

  const groups: OptionGroup[] = [];
  if (ungrouped.length > 0) {
    groups.push({ heading: null, options: ungrouped });
  }
  for (const heading of headingOrder) {
    groups.push({ heading, options: byHeading.get(heading)! });
  }
  return groups;
}

function OptionItems({
  options,
  value,
  onSelect,
}: {
  options: SearchableSelectOption[];
  value: string;
  onSelect: (next: string) => void;
}) {
  return options.map((option) => (
    <CommandItem
      key={option.value}
      value={`${option.label} ${option.keywords ?? option.value}`}
      onSelect={() => onSelect(option.value)}
    >
      <Check
        className={cn(
          "size-4",
          value === option.value ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="truncate">{option.label}</span>
    </CommandItem>
  ));
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Choose an option",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  disabled = false,
  className,
  contentClassName,
}: {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const groups = useMemo(() => groupOptions(options), [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(triggerClassName, className)}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[var(--anchor-width)] p-0", contentClassName)}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup
                key={group.heading ?? "__ungrouped__"}
                heading={group.heading ?? undefined}
              >
                <OptionItems
                  options={group.options}
                  value={value}
                  onSelect={(next) => {
                    onValueChange(next);
                    setOpen(false);
                  }}
                />
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
