import { BookGridSkeleton, Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="space-y-6 py-4">
      <div className="bc-card space-y-4 p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>

      <BookGridSkeleton count={6} />
    </div>
  );
}
