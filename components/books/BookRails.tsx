import type { RecommendedBook } from "@/types/database";
import type { CatalogueBook } from "@/lib/data/catalogue";
import { BookCard, BookGrid, BookRail } from "./BookCard";

/** Largeur d'une carte dans un rail : deux et demie à l'écran sur mobile. */
const RAIL_CARD = "w-[132px] shrink-0 sm:w-[150px]";

/** Rail horizontal de livres du catalogue (avec note et badge bibliothèque). */
export function CatalogueRail({
  label,
  items,
}: {
  label: string;
  items: CatalogueBook[];
}) {
  return (
    <BookRail label={label}>
      {items.map(({ book, stats, in_library }) => (
        <BookCard
          key={book.id}
          book={book}
          rating={stats.average_rating}
          ratingsCount={stats.ratings_count}
          inLibrary={in_library}
          className={RAIL_CARD}
        />
      ))}
    </BookRail>
  );
}

/**
 * Rail de recommandations : chaque livre porte **sa raison** en légende,
 * c'est ce qui rend la suggestion crédible.
 */
export function RecommendationRail({
  label,
  items,
}: {
  label: string;
  items: RecommendedBook[];
}) {
  return (
    <BookRail label={label}>
      {items.map(({ book, reason }) => (
        <div key={book.id} className={RAIL_CARD}>
          <BookCard book={book} />
          <p className="mt-1 text-[11px] font-medium leading-snug text-primary line-clamp-2-safe">
            {reason}
          </p>
        </div>
      ))}
    </BookRail>
  );
}

/** Grille de résultats du catalogue. */
export function CatalogueGrid({ items }: { items: CatalogueBook[] }) {
  return (
    <BookGrid>
      {items.map(({ book, stats, in_library }, index) => (
        <BookCard
          key={book.id}
          book={book}
          rating={stats.average_rating}
          ratingsCount={stats.ratings_count}
          inLibrary={in_library}
          priority={index < 4}
        />
      ))}
    </BookGrid>
  );
}
