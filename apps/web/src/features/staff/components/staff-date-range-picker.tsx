import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  formatDateParam,
  formatRangeLabel,
  staffRangeToDateRange,
  STAFF_RANGE_PRESETS,
  type StaffDateRange,
  type StaffDaysFilter,
} from "../utils/staff-filters";

const triggerClassName = cn(
  "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors sm:w-[220px]",
  "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
);

export function StaffDateRangePicker({
  range,
  onRangeChange,
}: {
  range: StaffDateRange;
  onRangeChange: (range: StaffDateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() => staffRangeToDateRange(range));

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setDraft(staffRangeToDateRange(range));
  };

  const applyPreset = (days: StaffDaysFilter) => {
    onRangeChange({ kind: "preset", days });
    setOpen(false);
  };

  const handleSelect = (next: DateRange | undefined) => {
    setDraft(next);
    if (!next?.from || !next.to) return;

    onRangeChange({
      kind: "custom",
      from: formatDateParam(next.from),
      to: formatDateParam(next.to),
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger className={triggerClassName}>
        <span className="truncate">{formatRangeLabel(range)}</span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <PopoverHeader className="sr-only">
          <PopoverTitle>Select date range</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col sm:flex-row">
          <div className="p-2">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={handleSelect}
              disabled={{ after: new Date() }}
              defaultMonth={draft?.from ?? new Date()}
              numberOfMonths={1}
            />
          </div>
          <Separator orientation="vertical" className="hidden sm:block" />
          <Separator className="sm:hidden" />
          <div className="flex flex-col gap-0.5 p-2 sm:w-36">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Presets</p>
            {STAFF_RANGE_PRESETS.map((preset) => {
              const active = range.kind === "preset" && range.days === preset.days;

              return (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                    active && "bg-muted font-medium",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
