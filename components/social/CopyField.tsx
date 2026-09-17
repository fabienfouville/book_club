"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Valeur copiable en un geste. `navigator.clipboard` n'existe pas hors HTTPS :
 * on retombe alors sur une sélection du texte, toujours utilisable.
 */
export function CopyField({
  value,
  label,
  mono,
}: {
  value: string;
  label: string;
  mono?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setState("copied");
        window.setTimeout(() => setState("idle"), 2200);
        return;
      }
    } catch {
      // Repli ci-dessous.
    }
    inputRef.current?.select();
    setState("manual");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          readOnly
          value={value}
          aria-label={label}
          onFocus={(event) => event.currentTarget.select()}
          className={
            "min-h-[46px] w-full min-w-0 rounded-xl border border-border-strong bg-surface-muted px-3 text-sm text-ink outline-none focus:border-primary" +
            (mono ? " font-mono tracking-[0.2em]" : "")
          }
        />
        <Button type="button" variant="secondary" onClick={copy} className="shrink-0">
          {state === "copied" ? "Copié ✓" : "Copier"}
        </Button>
      </div>
      <p aria-live="polite" className="text-xs text-ink-faint">
        {state === "copied"
          ? "Copié dans le presse-papiers."
          : state === "manual"
            ? "Copie automatique indisponible : le texte est sélectionné, faites Ctrl+C."
            : label}
      </p>
    </div>
  );
}
