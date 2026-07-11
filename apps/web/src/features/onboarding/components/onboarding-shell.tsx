import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OnboardingShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
}

export function OnboardingShell({
  title,
  description,
  children,
  sidebar,
  footer,
  compact = false,
}: OnboardingShellProps) {
  return (
    <main className="min-h-dvh w-full bg-background text-foreground">
      <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
        <Card
          className={cn(
            "w-full overflow-hidden pb-0 gap-0",
            sidebar ? "max-w-5xl" : compact ? "max-w-md" : "max-w-lg",
          )}
        >
          <CardHeader className={cn(sidebar && "border-b border-border")}>
            <CardTitle className="font-heading text-xl">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>

          {sidebar ? (
            <div className="flex min-h-112 flex-col sm:flex-row">
              <aside className="shrink-0 border-b border-border bg-muted/20 p-4 sm:w-52 sm:border-r sm:border-b-0">
                {sidebar}
              </aside>
              <div className="flex min-h-0 flex-1 flex-col">
                <CardContent className="flex flex-1 flex-col p-6">{children}</CardContent>
                {footer && (
                  <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                    {footer}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <CardContent className="p-6">{children}</CardContent>
              {footer && <CardFooter className="justify-end gap-2">{footer}</CardFooter>}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
