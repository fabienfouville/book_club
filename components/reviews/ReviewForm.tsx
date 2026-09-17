"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { deleteReview, upsertReview } from "@/app/bibliotheque/actions";
import { REVIEW_MAX } from "@/lib/library/types";

export interface ReviewDraft {
  id?: string;
  body: string;
  has_spoiler: boolean;
}

/**
 * Rédaction et modification d'un avis. Le même formulaire sert à créer et à
 * corriger : l'avis est unique par membre et par livre.
 */
export function ReviewForm({
  bookId,
  review,
  disabled,
  onDone,
  onCancel,
}: {
  bookId: string;
  review: ReviewDraft | null;
  disabled?: boolean;
  /** Appelé après une publication ou une suppression réussie. */
  onDone?: (review: ReviewDraft | null) => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(review?.body ?? "");
  const [hasSpoiler, setHasSpoiler] = useState(review?.has_spoiler ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const reste = REVIEW_MAX - body.length;
  const tropLong = reste < 0;
  const vide = body.trim().length < 3;
  const bloque = Boolean(disabled) || pending;

  function publier() {
    setError(null);
    startTransition(async () => {
      const res = await upsertReview(bookId, body.trim(), hasSpoiler);
      if (res.ok) {
        onDone?.({ id: review?.id, body: body.trim(), has_spoiler: hasSpoiler });
      } else {
        setError(res.error);
      }
    });
  }

  function supprimer() {
    setError(null);
    startTransition(async () => {
      const res = await deleteReview(bookId);
      if (res.ok) {
        setBody("");
        setHasSpoiler(false);
        setConfirmDelete(false);
        onDone?.(null);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <Field
        label={review ? "Modifier votre avis" : "Votre avis"}
        htmlFor="avis-corps"
        hint="Dites ce que ce livre vous a fait, ce que vous en retenez."
      >
        <Textarea
          id="avis-corps"
          value={body}
          disabled={bloque}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ce livre m'a…"
          aria-describedby="avis-compteur"
        />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={hasSpoiler}
            disabled={bloque}
            onChange={(e) => setHasSpoiler(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-primary"
          />
          <span>
            Contient des révélations
            <span className="block text-xs text-ink-faint">
              L&apos;avis sera masqué jusqu&apos;à ce qu&apos;on le demande.
            </span>
          </span>
        </label>

        <span
          id="avis-compteur"
          aria-live="polite"
          className={cn(
            "shrink-0 text-xs tabular-nums",
            tropLong ? "font-semibold text-danger" : "text-ink-faint",
          )}
        >
          {body.length} / {REVIEW_MAX}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={publier} disabled={bloque || vide || tropLong}>
          {pending ? "Envoi…" : review ? "Enregistrer" : "Publier mon avis"}
        </Button>

        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        ) : null}

        {review ? (
          confirmDelete ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <span className="text-sm text-ink-soft">Supprimer cet avis ?</span>
              <Button variant="danger" size="sm" onClick={supprimer} disabled={pending}>
                Oui, supprimer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
              >
                Non
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={bloque}
              className="text-danger"
            >
              Supprimer
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}

export default ReviewForm;
