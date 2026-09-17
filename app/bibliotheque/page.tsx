import type { Metadata } from "next";
import { BookCard, BookGrid } from "@/components/books/BookCard";
import { ButtonLink } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import {
  countByShelf,
  filterEntries,
  genresPresents,
  getMyLibrary,
} from "@/lib/library/queries";
import { parseLibraryParams } from "@/lib/library/url";
import { SHELF_LABELS } from "@/types/database";

export const metadata: Metadata = {
  title: "Ma bibliothèque",
  description:
    "Vos étagères, vos livres possédés, ceux que vous prêtez et ceux qui vous font envie.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BibliothequePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseLibraryParams(await searchParams);
  const { demo, anonymous, entries } = await getMyLibrary();

  const entete = (
    <SectionTitle
      title="Ma bibliothèque"
      subtitle={
        entries.length > 0
          ? `${entries.length} livre${entries.length > 1 ? "s" : ""} rangé${entries.length > 1 ? "s" : ""}`
          : undefined
      }
      action={
        entries.length > 0 ? (
          <ButtonLink href="/bibliotheque/statistiques" variant="secondary" size="sm">
            📊 Statistiques
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (demo) {
    return (
      <div className="space-y-4">
        {entete}
        <DemoNotice />
        <EmptyState
          emoji="🔌"
          title="Bibliothèque indisponible en mode démo"
          description="Connectez Supabase pour ranger vos livres, les noter et les prêter. En attendant, le catalogue reste consultable."
          actionLabel="Parcourir le catalogue"
          actionHref="/decouvrir"
        />
      </div>
    );
  }

  if (anonymous) {
    return (
      <div className="space-y-4">
        {entete}
        <EmptyState
          emoji="🔐"
          title="Votre bibliothèque vous attend"
          description="Connectez-vous pour retrouver vos étagères, vos notes et vos avis."
          actionLabel="Se connecter"
          actionHref="/connexion?suite=%2Fbibliotheque"
        />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        {entete}
        <EmptyState
          emoji="🌱"
          title="Vos étagères sont encore vides"
          description="Ajoutez un premier livre : celui que vous lisez en ce moment, ou celui dont tout le monde vous parle."
          actionLabel="Trouver un livre"
          actionHref="/decouvrir"
        />
      </div>
    );
  }

  const visibles = filterEntries(entries, filters);
  const counts = countByShelf(entries);
  const genres = genresPresents(entries);

  return (
    <div className="space-y-5">
      {entete}

      <LibraryFilters
        filters={filters}
        counts={counts}
        total={entries.length}
        genres={genres}
      />

      <p aria-live="polite" className="text-sm text-ink-soft">
        {visibles.length === 0
          ? "Aucun livre ne correspond"
          : `${visibles.length} livre${visibles.length > 1 ? "s" : ""}`}
        {filters.q ? ` pour « ${filters.q} »` : ""}
      </p>

      {visibles.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Rien sous ce filtre"
          description="Essayez une autre étagère, un autre genre, ou effacez la recherche."
          actionLabel="Ajouter un livre"
          actionHref="/decouvrir"
        />
      ) : (
        <BookGrid>
          {visibles.map((entry, index) => (
            <BookCard
              key={entry.book.id}
              book={entry.book}
              rating={entry.my_rating}
              priority={index < 4}
              badge={
                filters.shelf === null
                  ? SHELF_LABELS[entry.item.shelf]
                  : entry.item.is_lendable
                    ? "Je le prête"
                    : entry.item.is_owned
                      ? "Je l'ai"
                      : undefined
              }
            />
          ))}
        </BookGrid>
      )}
    </div>
  );
}
