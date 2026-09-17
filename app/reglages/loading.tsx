import { Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="space-y-6 py-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-[420px] w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
