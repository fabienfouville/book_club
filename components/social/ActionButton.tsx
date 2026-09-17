"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/lib/social/types";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";

/**
 * Bouton relié à une Server Action déjà liée à ses arguments.
 * Affiche l'erreur renvoyée sous le bouton, en français.
 */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "sm",
  confirmLabel,
  ariaLabel,
  className,
  onDone,
}: {
  action: () => Promise<ActionResult<Record<string, never>>>;
  children: React.ReactNode;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  /** Si renseigné, un premier appui demande confirmation. */
  confirmLabel?: string;
  ariaLabel?: string;
  className?: string;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  function run() {
    if (confirmLabel && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else onDone?.();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={armed ? "danger" : variant}
        size={size}
        disabled={pending}
        aria-label={ariaLabel}
        onClick={run}
        onBlur={() => setArmed(false)}
        className={className}
      >
        {pending ? "…" : armed ? confirmLabel : children}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
