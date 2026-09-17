import { BookGridSkeleton, Skeleton } from "@/components/ui/States";

export default function Chargement() {
  return (
    <div className="space-y-5 py-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-full" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <BookGridSkeleton />
    </div>
  );
}
