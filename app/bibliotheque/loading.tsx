import { BookGridSkeleton, Skeleton } from "@/components/ui/States";

/** Squelette de la bibliothèque : mêmes gabarits que la page réelle. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      <Skeleton className="h-[46px] w-full rounded-xl" />

      {[5, 4, 6].map((n, row) => (
        <div key={row} className="no-scrollbar -mx-4 flex gap-2 overflow-hidden px-4">
          {Array.from({ length: n }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      ))}

      <BookGridSkeleton count={10} />
    </div>
  );
}
