import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bc-gradient text-white shadow-tiny hover:brightness-110 active:brightness-95",
  secondary:
    "bg-surface text-ink border border-border-strong hover:bg-surface-muted",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-110",
  gold: "bg-gold text-violet-950 hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  // 44 px de haut minimum : confort tactile sur mobile.
  sm: "min-h-[38px] px-3 text-sm gap-1.5",
  md: "min-h-[44px] px-4 text-sm gap-2",
  lg: "min-h-[52px] px-6 text-base gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-full font-semibold transition " +
  "disabled:opacity-50 disabled:pointer-events-none select-none";

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
