"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Panneau glissant depuis le bas sur mobile, boîte centrée sur grand écran.
 * S'appuie sur `<dialog>` natif : le piège de focus et la fermeture par Échap
 * sont fournis par le navigateur, sans dépendance.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Empêche le défilement de l'arrière-plan pendant l'ouverture.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        // Un clic sur le fond (et non sur le contenu) referme le panneau.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "mx-auto mb-0 mt-auto w-full max-w-none rounded-2xl rounded-b-none border border-border",
        "bg-surface p-0 text-ink shadow-soft backdrop:bg-violet-950/60 backdrop:backdrop-blur-[2px]",
        "sm:my-auto sm:max-w-lg sm:rounded-b-2xl",
        className,
      )}
    >
      <div className="flex max-h-[86dvh] flex-col">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-base font-bold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-sm text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-surface-muted"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div
          className="overflow-y-auto px-4 py-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}
