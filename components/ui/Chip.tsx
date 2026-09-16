"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

const BASE =
  "inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 " +
  "text-sm font-medium transition whitespace-nowrap";

const ON = "bc-gradient border-transparent text-white shadow-tiny";
const OFF = "border-border-strong bg-surface text-ink-soft hover:bg-surface-muted";

export function Chip({
  active,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button type="button" title={title} onClick={onClick} className={cn(BASE, active ? ON : OFF)}>
      {children}
    </button>
  );
}

export function ChipLink({
  active,
  href,
  children,
}: {
  active?: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} scroll={false} className={cn(BASE, active ? ON : OFF)}>
      {children}
    </Link>
  );
}

/** Rangée de puces défilante — le motif de filtrage principal sur mobile. */
export function ChipRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
    >
      {children}
    </div>
  );
}
