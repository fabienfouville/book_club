import { cn } from "@/lib/cn";
import { ButtonLink } from "./Button";

/** État vide : illustré, jamais culpabilisant, toujours avec une porte de sortie. */
export function EmptyState({
  emoji = "✨",
  title,
  description,
  actionLabel,
  actionHref,
}: {
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="bc-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div
        aria-hidden
        className="grid h-16 w-16 place-items-center rounded-2xl bg-primary-soft text-3xl"
      >
        {emoji}
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-ink-soft">{description}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <ButtonLink href={actionHref} className="mt-1">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bc-skeleton", className)} aria-hidden />;
}

export function BookGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "success";
  children: React.ReactNode;
}) {
  const tones = {
    info: "bg-primary-soft text-ink border-border-strong",
    warn: "bg-accent-soft text-ink border-accent",
    success: "bg-surface-muted text-ink border-success",
  } as const;
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
