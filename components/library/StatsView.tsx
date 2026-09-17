import { GENRE_BY_SLUG } from "@/lib/data/genres";
import { monthShortFr } from "@/lib/library/dates";
import type { LibraryStats } from "@/lib/library/queries";
import { cn } from "@/lib/cn";

function Tile({
  label,
  value,
  hint,
  emoji,
}: {
  label: string;
  value: string;
  hint?: string;
  emoji: string;
}) {
  return (
    <div className="bc-card flex items-start gap-3 p-4">
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-xl"
      >
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </p>
        <p className="font-display text-2xl font-extrabold leading-tight text-ink">
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Barre horizontale d'un genre : la valeur est aussi écrite en toutes lettres. */
function GenreBar({
  slug,
  count,
  max,
}: {
  slug: string;
  count: number;
  max: number;
}) {
  const genre = GENRE_BY_SLUG.get(slug);
  const largeur = max > 0 ? Math.max(6, Math.round((count / max) * 100)) : 0;
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="flex w-32 shrink-0 items-center gap-1.5 truncate text-ink-soft sm:w-44">
        <span aria-hidden>{genre?.emoji ?? "📚"}</span>
        <span className="truncate">{genre?.label ?? slug}</span>
      </span>
      <span
        aria-hidden
        className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted"
      >
        <span
          className="bc-gradient block h-full rounded-full"
          style={{ width: `${largeur}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
        {count}
        <span className="sr-only"> livre{count > 1 ? "s" : ""} lu{count > 1 ? "s" : ""}</span>
      </span>
    </li>
  );
}

/** Rythme de lecture : 12 colonnes, une par mois. */
function Pace({ pace }: { pace: LibraryStats["pace"] }) {
  const max = Math.max(1, ...pace.map((p) => p.count));
  const total = pace.reduce((a, b) => a + b.count, 0);

  return (
    <div>
      <p className="mb-3 text-sm text-ink-soft">
        {total === 0
          ? "Aucun livre terminé sur les 12 derniers mois."
          : `${total} livre${total > 1 ? "s" : ""} terminé${total > 1 ? "s" : ""} sur 12 mois, soit ${(total / 12).toFixed(1)} par mois.`}
      </p>

      <ul className="flex h-36 items-end gap-1 sm:gap-2">
        {pace.map((mois) => {
          const hauteur = Math.round((mois.count / max) * 100);
          const libelle = `${monthShortFr(mois.month)} ${mois.year}`;
          return (
            <li key={mois.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold tabular-nums text-ink-soft">
                {mois.count > 0 ? mois.count : ""}
              </span>
              <span
                aria-hidden
                className="flex w-full flex-1 items-end"
                title={`${libelle} : ${mois.count}`}
              >
                <span
                  className={cn(
                    "block w-full rounded-t-md transition-all",
                    mois.count > 0 ? "bc-gradient" : "bg-surface-muted",
                  )}
                  style={{ height: `${Math.max(hauteur, 4)}%` }}
                />
              </span>
              <span className="text-[10px] leading-none text-ink-faint">
                {monthShortFr(mois.month).slice(0, 4)}
              </span>
              <span className="sr-only">
                {libelle} : {mois.count} livre{mois.count > 1 ? "s" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Toutes les statistiques de lecture, sans bibliothèque de graphiques. */
export function StatsView({ stats }: { stats: LibraryStats }) {
  const topGenre = stats.topGenre
    ? (GENRE_BY_SLUG.get(stats.topGenre.slug)?.label ?? stats.topGenre.slug)
    : null;
  const maxGenre = stats.byGenre[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Tile
          emoji="✅"
          label="Livres lus"
          value={String(stats.booksRead)}
          hint={
            stats.reading > 0
              ? `${stats.reading} en cours, ${stats.wishlist} en attente`
              : `${stats.wishlist} livre${stats.wishlist > 1 ? "s" : ""} en attente`
          }
        />
        <Tile
          emoji="📄"
          label="Pages lues"
          value={stats.pagesRead.toLocaleString("fr-FR")}
          hint={
            stats.pagesEstimated
              ? "Estimation : certains livres n'annoncent pas leur pagination."
              : "D'après la pagination des éditeurs."
          }
        />
        <Tile
          emoji={
            stats.topGenre
              ? (GENRE_BY_SLUG.get(stats.topGenre.slug)?.emoji ?? "📚")
              : "📚"
          }
          label="Genre le plus lu"
          value={topGenre ?? "—"}
          hint={
            stats.topGenre
              ? `${stats.topGenre.count} livre${stats.topGenre.count > 1 ? "s" : ""}`
              : "Lisez un premier livre pour le savoir."
          }
        />
        <Tile
          emoji="⭐"
          label="Note moyenne donnée"
          value={stats.averageGiven ? `${stats.averageGiven.toFixed(1)} / 5` : "—"}
          hint={
            stats.ratingsGiven > 0
              ? `Sur ${stats.ratingsGiven} livre${stats.ratingsGiven > 1 ? "s" : ""} noté${stats.ratingsGiven > 1 ? "s" : ""}`
              : "Vous n'avez encore rien noté."
          }
        />
      </div>

      <section className="bc-card p-4" aria-labelledby="titre-genres">
        <h2
          id="titre-genres"
          className="font-display text-lg font-bold tracking-tight text-ink"
        >
          Ce que vous lisez
        </h2>
        {stats.byGenre.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            Rangez un livre sur l&apos;étagère « Lu » pour voir vos genres
            préférés apparaître ici.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {stats.byGenre.slice(0, 10).map((g) => (
              <GenreBar key={g.slug} slug={g.slug} count={g.count} max={maxGenre} />
            ))}
          </ul>
        )}
      </section>

      <section className="bc-card p-4" aria-labelledby="titre-rythme">
        <h2
          id="titre-rythme"
          className="font-display text-lg font-bold tracking-tight text-ink"
        >
          Votre rythme de lecture
        </h2>
        <p className="mb-2 text-xs text-ink-faint">12 derniers mois</p>
        <Pace pace={stats.pace} />
      </section>

      <section className="bc-card p-4" aria-labelledby="titre-etageres">
        <h2
          id="titre-etageres"
          className="font-display text-lg font-bold tracking-tight text-ink"
        >
          Votre étagère physique
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface-muted px-3 py-2.5">
            <dt className="text-xs text-ink-soft">Livres possédés</dt>
            <dd className="font-display text-xl font-bold text-ink">
              {stats.owned}
            </dd>
          </div>
          <div className="rounded-xl bg-surface-muted px-3 py-2.5">
            <dt className="text-xs text-ink-soft">Prêtés volontiers</dt>
            <dd className="font-display text-xl font-bold text-ink">
              {stats.lendable}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default StatsView;
