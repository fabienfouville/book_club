"use client";

import { useState, useTransition } from "react";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { StarsInput } from "@/components/ui/Stars";
import { ReviewForm, type ReviewDraft } from "@/components/reviews/ReviewForm";
import { SHELF_LABELS, type Shelf } from "@/types/database";
import type { ActionResult } from "@/lib/library/types";
import { cn } from "@/lib/cn";
import {
  rateBook,
  removeFromLibrary,
  setLendable,
  setOwned,
  setShelf,
} from "@/app/bibliotheque/actions";

const SHELVES = Object.keys(SHELF_LABELS) as Shelf[];

const SHELF_EMOJI: Record<Shelf, string> = {
  wishlist: "✨",
  reading: "📖",
  read: "✅",
  abandoned: "💤",
};

interface Etat {
  shelf: Shelf | null;
  is_owned: boolean;
  is_lendable: boolean;
  rating: number | null;
}

/** Interrupteur tactile, 44 px de haut, libellé cliquable. */
function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
        "disabled:opacity-50",
        checked
          ? "border-primary bg-primary-soft"
          : "border-border-strong bg-surface hover:bg-surface-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bc-gradient" : "bg-surface-muted ring-1 ring-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-tiny transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-semibold",
            checked ? "text-primary" : "text-ink",
          )}
        >
          {label}
        </span>
        {hint ? <span className="block text-xs text-ink-faint">{hint}</span> : null}
      </span>
    </button>
  );
}

/**
 * Tout ce qu'un membre fait d'un livre : l'étagère, la possession, le prêt,
 * la note et l'avis.
 *
 * Les bascules sont **optimistes** : l'affichage change immédiatement, la
 * Server Action suit, et l'état d'avant est rétabli si elle échoue.
 */
export function BookActionsClient({
  bookId,
  initial,
  initialReview,
  disabled,
}: {
  bookId: string;
  initial: Etat;
  initialReview: ReviewDraft | null;
  disabled?: boolean;
}) {
  const [etat, setEtat] = useState<Etat>(initial);
  const [review, setReview] = useState<ReviewDraft | null>(initialReview);
  const [formOuvert, setFormOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bloque = Boolean(disabled) || pending;
  const dansBiblio = etat.shelf !== null;

  /** Applique l'état visé tout de suite, puis confirme côté serveur. */
  function appliquer(vise: Etat, action: () => Promise<ActionResult>) {
    const avant = etat;
    setEtat(vise);
    setErreur(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setEtat(avant);
        setErreur(res.error);
      }
    });
  }

  function choisirEtagere(shelf: Shelf) {
    if (etat.shelf === shelf) {
      // Re-cliquer sur l'étagère active sort le livre de la bibliothèque.
      appliquer(
        { ...etat, shelf: null, is_owned: false, is_lendable: false },
        () => removeFromLibrary(bookId),
      );
      return;
    }
    appliquer({ ...etat, shelf }, () => setShelf(bookId, shelf));
  }

  return (
    <div className="space-y-5">
      {/* --------------------------------------------------------- étagère */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Mon étagère</h3>
        <div
          role="group"
          aria-label="Choisir une étagère"
          aria-busy={pending}
          className={cn(
            "no-scrollbar -mx-1 flex flex-wrap gap-2 px-1 transition-opacity",
            bloque && "opacity-60",
          )}
        >
          {SHELVES.map((shelf) => {
            const actif = etat.shelf === shelf;
            return (
              <Chip
                key={shelf}
                active={actif}
                title={actif ? "Retirer de ma bibliothèque" : undefined}
                onClick={bloque ? undefined : () => choisirEtagere(shelf)}
              >
                <span aria-hidden>{SHELF_EMOJI[shelf]}</span>
                {SHELF_LABELS[shelf]}
              </Chip>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          {dansBiblio
            ? "Touchez à nouveau l'étagère active pour retirer ce livre."
            : "Rangez ce livre pour le retrouver dans votre bibliothèque."}
        </p>
      </div>

      {/* ------------------------------------------------------ possession */}
      {dansBiblio ? (
        <div className="space-y-2">
          <Toggle
            label="Je possède ce livre"
            checked={etat.is_owned}
            disabled={bloque}
            onChange={(next) =>
              appliquer(
                {
                  ...etat,
                  is_owned: next,
                  is_lendable: next ? etat.is_lendable : false,
                },
                () => setOwned(bookId, next),
              )
            }
          />
          {etat.is_owned ? (
            <Toggle
              label="Je le prête volontiers"
              hint="Vos amis et vos communautés pourront vous l'emprunter."
              checked={etat.is_lendable}
              disabled={bloque}
              onChange={(next) =>
                appliquer({ ...etat, is_lendable: next }, () =>
                  setLendable(bookId, next),
                )
              }
            />
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ note */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-ink">Ma note</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StarsInput
            value={etat.rating}
            disabled={bloque}
            onChange={(n) => {
              // Re-cliquer sur la note actuelle l'efface.
              const vise = etat.rating === n ? null : n;
              appliquer({ ...etat, rating: vise }, () => rateBook(bookId, vise));
            }}
          />
          {etat.rating ? (
            <button
              type="button"
              disabled={bloque}
              onClick={() =>
                appliquer({ ...etat, rating: null }, () => rateBook(bookId, null))
              }
              className="min-h-[44px] text-sm text-ink-faint underline underline-offset-4 transition hover:text-ink disabled:opacity-50"
            >
              Retirer ma note
            </button>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------------------ avis */}
      <div>
        {formOuvert ? (
          <ReviewForm
            bookId={bookId}
            review={review}
            disabled={disabled}
            onCancel={() => setFormOuvert(false)}
            onDone={(next) => {
              setReview(next);
              setFormOuvert(false);
            }}
          />
        ) : (
          <Button
            variant="secondary"
            onClick={() => setFormOuvert(true)}
            disabled={bloque}
            className="w-full sm:w-auto"
          >
            {review ? "✍️ Modifier mon avis" : "✍️ Écrire un avis"}
          </Button>
        )}
      </div>

      {erreur ? (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
