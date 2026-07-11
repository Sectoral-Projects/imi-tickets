import type { ReactNode } from "react";
import { Forward } from "lucide-react";
import { cn } from "@/lib/utils";

type ForwardedMessageFrameProps = {
  children: ReactNode;
  className?: string;
};

export function ForwardedMessageFrame({ children, className }: ForwardedMessageFrameProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1.5 text-xs italic text-muted-foreground">
        <Forward className="size-3.5 shrink-0" aria-hidden />
        <span>Forwarded</span>
      </div>
      <div className="flex gap-2.5">
        <div
          className="w-1 shrink-0 self-stretch rounded-full bg-muted-foreground/35"
          aria-hidden
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
