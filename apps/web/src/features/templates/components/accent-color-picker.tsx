import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  accentIntToHex,
  accentIntToStyle,
  DISCORD_ACCENT_PRESETS,
  hexToAccentInt,
} from "../utils/component-v2";

const triggerClassName = cn(
  "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors",
  "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function AccentColorPicker({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hex = accentIntToHex(value);
  const preset = DISCORD_ACCENT_PRESETS.find((entry) => entry.value === value);

  const handleHexChange = (nextHex: string) => {
    onChange(hexToAccentInt(nextHex));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} className={triggerClassName}>
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="size-4 shrink-0 rounded-full ring-1 ring-border"
            style={accentIntToStyle(value)}
          />
          <span className="truncate">{preset?.name ?? hex.toUpperCase()}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-80 gap-3 p-3" align="start">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
          <div className="accent-color-picker shrink-0">
            <HexColorPicker color={hex} onChange={handleHexChange} />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Discord presets</Label>
            <div className="grid grid-cols-2 justify-items-center gap-1.5">
              {DISCORD_ACCENT_PRESETS.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  title={entry.name}
                  aria-label={entry.name}
                  aria-pressed={entry.value === value}
                  className={cn(
                    "size-8 shrink-0 rounded-md ring-1 ring-border transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring",
                    entry.value === value && "ring-2 ring-ring",
                  )}
                  style={accentIntToStyle(entry.value)}
                  onClick={() => onChange(entry.value)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accent-hex" className="text-xs text-muted-foreground">
            Hex
          </Label>
          <Input
            id="accent-hex"
            value={hex}
            onChange={(event) => handleHexChange(event.target.value)}
            className="font-mono text-xs uppercase"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
