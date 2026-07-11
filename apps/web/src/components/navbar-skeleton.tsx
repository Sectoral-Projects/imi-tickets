import { Skeleton } from "@/components/ui/skeleton";

export function NavbarSkeleton() {
  return (
    <section className="py-4" aria-busy="true" aria-hidden>
      <div className="container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Skeleton className="h-8 w-32" />
            <div className="hidden items-center gap-2 lg:flex">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>
    </section>
  );
}
