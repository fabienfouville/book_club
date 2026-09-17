"use client";

import { useState } from "react";

/**
 * Masque un avis qui contient des révélations. Le texte n'est monté qu'après
 * un geste explicite : impossible de le lire par accident en défilant.
 */
export function SpoilerGuard({ children }: { children: React.ReactNode }) {
  const [revele, setRevele] = useState(false);

  if (revele) return <>{children}</>;

  return (
    <div className="rounded-xl border border-dashed border-accent bg-accent-soft px-4 py-4 text-center">
      <p className="text-sm font-semibold text-ink">
        ⚠️ Cet avis contient des révélations
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">
        Il raconte des passages du livre que vous n&apos;avez peut-être pas lus.
      </p>
      <button
        type="button"
        onClick={() => setRevele(true)}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-muted"
      >
        Afficher malgré tout
      </button>
    </div>
  );
}

export default SpoilerGuard;
