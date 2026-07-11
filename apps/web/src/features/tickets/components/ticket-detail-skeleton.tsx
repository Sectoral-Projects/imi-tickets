import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

function MessageBlockSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex gap-3 p-4 pr-16">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          {!compact && <Skeleton className="h-4 w-2/3" />}
        </div>
      </div>
    </Card>
  );
}

export function TicketDetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-busy="true" aria-live="polite">
      <header className="shrink-0 border-b p-4">
        <Skeleton className="mb-3 h-6 w-1/2 max-w-md" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="size-full">
        <div className="flex flex-col gap-4 p-4">
          <MessageBlockSkeleton />
          <MessageBlockSkeleton compact />
          <MessageBlockSkeleton />
          <MessageBlockSkeleton compact />
          <MessageBlockSkeleton />
        </div>
        </ScrollArea>
      </div>
    </div>
  );
}
