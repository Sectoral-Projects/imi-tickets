import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StaffChartSkeleton() {
  return <Skeleton className="h-[280px] w-full rounded-lg" aria-hidden />;
}

export function StaffMemberCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 5 }).map((__, statIndex) => (
              <div key={statIndex} className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StaffPageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-full sm:w-[180px]" />
        <Skeleton className="h-9 w-full sm:w-[220px]" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-5">
            <Skeleton className="min-h-22 rounded-lg" />
            <Skeleton className="min-h-22 rounded-lg" />
            <div className="flex min-h-22 flex-col gap-2 rounded-lg border border-border/60 p-3 md:col-span-2 lg:col-span-1">
              <Skeleton className="h-4 w-40" />
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                <Skeleton className="min-h-13 rounded-md" />
                <Skeleton className="min-h-13 rounded-md" />
                <Skeleton className="min-h-13 rounded-md" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-4 w-56" />
        </CardHeader>
        <CardContent>
          <StaffChartSkeleton />
        </CardContent>
      </Card>

      <StaffMemberCardsSkeleton />
    </div>
  );
}
