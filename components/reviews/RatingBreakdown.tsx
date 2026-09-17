import { StarsDisplay } from "@/components/ui/Stars";
import { getRatingDistribution } from "@/lib/library/queries";
import type { RatingDistribution } from "@/lib/library/types";

function pourcent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Répartition des notes, de 5 à 1. Purement visuel : chaque barre porte son
 * équivalent en texte, donc l'information passe aussi sans les couleurs.
 */
export function RatingBreakdown({
  distribution,
  className,
}: {
  distribution: RatingDistribution;
  className?: string;
}) {
  const { counts, total, average } = distribution;

  return (
    <section className={className} aria-label="Répartition des notes">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="font-display text-4xl font-extrabold leading-none text-ink">
            {average ? average.toFixed(1) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-faint">sur 5</p>
        </div>

        <div className="min-w-0">
          <StarsDisplay value={average} size={18} />
          <p className="mt-1 text-sm text-ink-soft">
            {total === 0
              ? "Pas encore de note"
              : total === 1
                ? "1 note"
                : `${total} notes`}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {[5, 4, 3, 2, 1].map((etoiles) => {
          const n = counts[etoiles - 1];
          const p = pourcent(n, total);
          return (
            <li key={etoiles} className="flex items-center gap-2.5 text-xs">
              <span className="w-12 shrink-0 text-ink-soft">
                {etoiles} <span aria-hidden>★</span>
                <span className="sr-only">
                  {etoiles === 1 ? "étoile" : "étoiles"}
                </span>
              </span>
              <span
                aria-hidden
                className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted"
              >
                <span
                  className="bc-gradient block h-full rounded-full transition-[width]"
                  style={{ width: `${p}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-ink-faint">
                {n} <span className="sr-only">note{n > 1 ? "s" : ""}, soit</span>
                <span aria-hidden> · </span>
                {p} %
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Variante autonome : va chercher la répartition du livre elle-même. */
export async function BookRatingBreakdown({
  bookId,
  className,
}: {
  bookId: string;
  className?: string;
}) {
  const distribution = await getRatingDistribution(bookId);
  return <RatingBreakdown distribution={distribution} className={className} />;
}

export default RatingBreakdown;
