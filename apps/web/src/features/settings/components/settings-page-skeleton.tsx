import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

function SettingRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-6 w-11 rounded-full" />
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto w-full max-w-3xl shrink-0 space-y-4 px-4 pt-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        <Skeleton className="h-8 w-full max-w-sm rounded-lg" />
      </div>

      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="overscroll-behavior-contain [overflow-anchor:none]"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-4 sm:px-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-28" />
                <Skeleton className="mt-2 h-4 w-full max-w-sm" />
              </CardHeader>
              <CardContent className="space-y-5">
                <SettingRowSkeleton />
                <SettingRowSkeleton />
                {index === 2 && (
                  <>
                    <SettingRowSkeleton />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <div className="mx-auto w-full max-w-3xl shrink-0 border-t border-border px-4 py-4 sm:px-6">
        <Skeleton className="ms-auto h-9 w-32" />
      </div>
    </div>
  );
}
