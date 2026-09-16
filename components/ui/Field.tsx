import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full min-h-[46px] rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 " +
  "text-base text-ink placeholder:text-ink-faint outline-none transition " +
  "focus:border-primary";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-[110px] resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cn(CONTROL, "appearance-none pr-9", className)} {...rest}>
      {children}
    </select>
  );
}
