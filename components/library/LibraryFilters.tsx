import Link from "next/link";
import { ChipLink, ChipRow } from "@/components/ui/Chip";
import { GENRE_BY_SLUG } from "@/lib/data/genres";
import { SHELF_LABELS, type Shelf } from "@/types/database";
import { OWNERSHIP_LABELS, OWNERSHIP_VALUES } from "@/lib/library/types";
import { hasActiveFilters, libraryHref } from "@/lib/library/url";
import type { LibraryFilters as Filters } from "@/lib/library/queries";
import { LibrarySearch } from "./LibrarySearch";

const SHELVES = Object.keys(SHELF_LABELS) as Shelf[];

/**
 * Les trois rangées de filtres de la bibliothèque. Tout est en liens : la vue
 * reste partageable et fonctionne sans JavaScript.
 */
export function LibraryFilters({
  filters,
  counts,
  total,
  genres,
}: {
  filters: Filters;
  counts: Record<Shelf, number>;
  /** Nombre de livres toutes étagères confondues. */
  total: number;
  /** Genres réellement présents dans la bibliothèque. */
  genres: string[];
}) {
  return (
    <div className="space-y-3">
      <LibrarySearch filters={filters} />

      <ChipRow label="Filtrer par étagère">
        <ChipLink
          active={filters.shelf === null}
          href={libraryHref(filters, { shelf: null })}
        >
          Toutes
          <span className="tabular-nums opacity-70">{total}</span>
        </ChipLink>
        {SHELVES.map((shelf) => (
          <ChipLink
            key={shelf}
            active={filters.shelf === shelf}
            href={libraryHref(filters, { shelf })}
          >
            {SHELF_LABELS[shelf]}
            <span className="tabular-nums opacity-70">{counts[shelf]}</span>
          </ChipLink>
        ))}
      </ChipRow>

      <ChipRow label="Filtrer par possession">
        {OWNERSHIP_VALUES.map((value) => (
          <ChipLink
            key={value}
            active={filters.ownership === value}
            href={libraryHref(filters, { ownership: value })}
          >
            {OWNERSHIP_LABELS[value]}
          </ChipLink>
        ))}
      </ChipRow>

      {genres.length > 0 ? (
        <ChipRow label="Filtrer par genre">
          <ChipLink
            active={filters.genre === null}
            href={libraryHref(filters, { genre: null })}
          >
            Tous les genres
          </ChipLink>
          {genres.map((slug) => {
            const genre = GENRE_BY_SLUG.get(slug);
            return (
              <ChipLink
                key={slug}
                active={filters.genre === slug}
                href={libraryHref(filters, { genre: slug })}
              >
                <span aria-hidden>{genre?.emoji ?? "📚"}</span>
                {genre?.label ?? slug}
              </ChipLink>
            );
          })}
        </ChipRow>
      ) : null}

      {hasActiveFilters(filters) ? (
        <Link
          href={libraryHref({
            shelf: null,
            genre: null,
            ownership: "tous",
            q: "",
          })}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary underline underline-offset-4"
        >
          Tout effacer
        </Link>
      ) : null}
    </div>
  );
}

export default LibraryFilters;
