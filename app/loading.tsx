import { Skeleton, BookGridSkeleton } from "@/components/ui/States";

export default function Chargement() {
  return (
    <div className="space-y-8 py-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <BookGridSkeleton count={5} />
      </div>
    </div>
  );
}
