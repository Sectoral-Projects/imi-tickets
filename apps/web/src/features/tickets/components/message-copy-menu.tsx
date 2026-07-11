import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stripMarkdown } from "../utils/messages/markdown";

type MessageCopyMenuProps = {
  content: string;
};

export function MessageCopyMenu({ content }: MessageCopyMenuProps) {
  const [copiedVariant, setCopiedVariant] = useState<"markdown" | "plain" | null>(null);

  async function copyText(text: string, variant: "markdown" | "plain") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedVariant(variant);
      window.setTimeout(() => setCopiedVariant(null), 2000);
    } catch {
      setCopiedVariant(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Copy message"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {copiedVariant ? <Check className="size-3" /> : <Copy className="size-3" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-44"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={() => copyText(content, "markdown")}>
          {copiedVariant === "markdown" ? "Copied with markdown" : "Copy with markdown"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyText(stripMarkdown(content), "plain")}>
          {copiedVariant === "plain" ? "Copied without markdown" : "Copy without markdown"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
