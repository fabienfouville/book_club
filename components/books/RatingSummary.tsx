import { StarsDisplay } from "@/components/ui/Stars";
import type { BookStats } from "@/types/database";

function plural(count: number, one: string, many: string) {
  return count > 1 ? many : one;
}

/**
 * Note moyenne, répartition des étoiles et nombre d'avis.
 * Chaque barre est doublée d'un texte : l'information passe sans les couleurs.
 */
export function RatingSummary({
  stats,
  distribution,
}: {
  stats: BookStats;
  distribution: number[];
}) {
  const total = distribution.reduce((a, b) => a + b, 0) || stats.ratings_count;

  return (
    <section aria-label="Notes et avis" className="bc-card p-4">
      <div className="flex items-start gap-4">
        <div className="text-center">
          <p className="font-display text-4xl font-extrabold leading-none">
            {stats.average_rating ? stats.average_rating.toFixed(1) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-faint">sur 5</p>
        </div>

        <div className="min-w-0 flex-1">
          <StarsDisplay value={stats.average_rating} size={18} />
          <p className="mt-1 text-sm text-ink-soft">
            {stats.ratings_count === 0
              ? "Personne ne l'a encore noté"
              : `${stats.ratings_count} ${plural(stats.ratings_count, "note", "notes")}`}
            {stats.reviews_count > 0
              ? ` · ${stats.reviews_count} ${plural(stats.reviews_count, "avis", "avis")}`
              : null}
          </p>
        </div>
      </div>

      {total > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star - 1] ?? 0;
            const percent = total ? Math.round((count / total) * 100) : 0;
            return (
              <li key={star} className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="w-10 shrink-0 tabular-nums">{star} ★</span>
                <span
                  aria-hidden
                  className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted"
                >
                  <span
                    className="block h-full rounded-full bg-gold"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right tabular-nums">
                  {count} ({percent} %)
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
