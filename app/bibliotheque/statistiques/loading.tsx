import { Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-6 w-48" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-card" />
        ))}
      </div>

      <Skeleton className="h-64 w-full rounded-card" />
      <Skeleton className="h-56 w-full rounded-card" />
    </div>
  );
}
