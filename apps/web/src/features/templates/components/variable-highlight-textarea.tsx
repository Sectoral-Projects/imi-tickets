import { useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { highlightTemplateVariables } from "../utils/variable-highlight";

export function VariableHighlightTextarea({
  className,
  value,
  onScroll,
  disabled,
  ...props
}: ComponentProps<"textarea">) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const text = String(value ?? "");

  const syncScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.scrollTop = event.currentTarget.scrollTop;
      backdrop.scrollLeft = event.currentTarget.scrollLeft;
    }
    onScroll?.(event);
  };

  return (
    <div className="relative w-full">
      <div
        ref={backdropRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent px-2.5 py-2 text-base md:text-sm",
          disabled && "opacity-50",
        )}
      >
        {highlightTemplateVariables(text)}
        {text.endsWith("\n") ? <br /> : null}
      </div>
      <textarea
        data-slot="textarea"
        {...props}
        value={value}
        disabled={disabled}
        onScroll={syncScroll}
        className={cn(
          "relative flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
          "text-transparent caret-foreground selection:bg-primary/20 selection:text-transparent",
          className,
        )}
      />
    </div>
  );
}
