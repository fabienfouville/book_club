"use client";

import { useState, useTransition } from "react";
import { toggleReviewLike } from "@/app/bibliotheque/actions";
import { cn } from "@/lib/cn";

/** Petite main levée : « cet avis m'a aidé ». */
function IconThumb({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10.5 11.2 3.6a2 2 0 0 1 3.7 1v3.9h4.2a1.9 1.9 0 0 1 1.85 2.33l-1.5 7A1.9 1.9 0 0 1 17.6 19.3H7" />
      <path d="M7 10.5v8.8H4.4a1.4 1.4 0 0 1-1.4-1.4v-6a1.4 1.4 0 0 1 1.4-1.4H7Z" />
    </svg>
  );
}

/**
 * Bouton « Utile » avec son compteur. La bascule est optimiste : le compteur
 * bouge tout de suite, et revient en place si le serveur refuse.
 */
export function ReviewLikeButton({
  reviewId,
  bookId,
  count,
  liked,
  disabled,
}: {
  reviewId: string;
  bookId: string;
  count: number;
  liked: boolean;
  disabled?: boolean;
}) {
  const [state, setState] = useState({ count, liked });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function basculer() {
    const avant = state;
    const apres = {
      liked: !avant.liked,
      count: avant.count + (avant.liked ? -1 : 1),
    };
    setState(apres);
    setError(null);
    startTransition(async () => {
      const res = await toggleReviewLike(reviewId, bookId);
      if (!res.ok) {
        setState(avant);
        setError(res.error);
      }
    });
  }

  const label = state.liked
    ? `Retirer « Utile » (${state.count})`
    : `Marquer cet avis comme utile (${state.count})`;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={basculer}
        disabled={disabled || pending}
        aria-pressed={state.liked}
        aria-label={label}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition",
          "disabled:opacity-50",
          state.liked
            ? "border-primary bg-primary-soft text-primary"
            : "border-border-strong bg-surface text-ink-soft hover:bg-surface-muted",
        )}
      >
        <IconThumb filled={state.liked} />
        <span>Utile</span>
        {state.count > 0 ? (
          <span className="tabular-nums font-semibold">{state.count}</span>
        ) : null}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export default ReviewLikeButton;
