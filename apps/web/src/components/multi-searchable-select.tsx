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
import type { SearchableSelectOption } from "./searchable-select";

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

export function MultiSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Choose options",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  disabled = false,
  className,
  contentClassName,
}: {
  options: SearchableSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => {
    const selectedSet = new Set(value);
    return options.filter((option) => selectedSet.has(option.value));
  }, [options, value]);
  const groups = useMemo(() => groupOptions(options), [options]);

  const label =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((option) => option.label).join(", ")
        : `${selected.length} selected`;

  const toggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onValueChange(value.filter((entry) => entry !== optionValue));
      return;
    }
    onValueChange([...value, optionValue]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(triggerClassName, className)}
      >
        <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
          {label}
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
                {group.options.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.keywords ?? option.value}`}
                      onSelect={() => toggle(option.value)}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
