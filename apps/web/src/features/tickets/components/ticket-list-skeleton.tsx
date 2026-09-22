import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TicketListSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="shrink-0 p-4 md:p-6">
        <div className="flex flex-row gap-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4 md:px-6 md:pb-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-2/5" />
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-1">
                  <Skeleton className="h-1.5 w-4 rounded-full" />
                  <div className="flex -space-x-2">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="size-6 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
