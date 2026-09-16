import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("bc-card p-4", className)} {...rest} />;
}

export function SectionTitle({
  title,
  action,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
