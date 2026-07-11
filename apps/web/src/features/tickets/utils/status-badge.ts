import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function ticketStatusBadgeVariant(status: string): BadgeVariant {
  return status === "open" ? "default" : "secondary";
}
