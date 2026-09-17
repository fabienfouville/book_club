import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/books/BookCover";
import { BookSynopsis } from "@/components/books/BookSynopsis";
import { RecommendationRail } from "@/components/books/BookRails";
import { BookRatingBreakdown } from "@/components/reviews/RatingBreakdown";
import { ReviewList } from "@/components/reviews/ReviewList";
import { BookActions } from "@/components/library/BookActions";
import { BookSocialActions } from "@/components/social/BookSocialActions";
import { getBookWithContext, getSimilarBooks } from "@/lib/data/catalogue";
import { getCurrentUser } from "@/lib/supabase/server";

export const revalidate = 0;

async function loadBook(id: string) {
  const user = await getCurrentUser();
  const book = await getBookWithContext(id, user?.id ?? null);
  return { book, userId: user?.id ?? null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { book } = await loadBook(id);
  if (!book) return { title: "Livre introuvable" };

  const description =
    book.description?.slice(0, 200) ??
    `${book.authors.join(", ") || "Auteur inconnu"} · Bookclub`;

  return {
    title: book.title,
    description,
    openGraph: {
      title: book.title,
      description,
      images: book.cover_url ? [{ url: book.cover_url }] : undefined,
    },
  };
}

export default async function LivrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { book } = await loadBook(id);
  if (!book) notFound();

  const similar = await getSimilarBooks(book.id, 12);

  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[180px_1fr] sm:gap-6">
        <BookCover
          title={book.title}
          authors={book.authors}
          url={book.cover_url}
          priority
          sizes="(max-width: 640px) 112px, 180px"
        />

        <div className="min-w-0 space-y-2">
          <h1 className="font-display text-xl font-extrabold leading-tight sm:text-2xl">
            {book.title}
          </h1>
          {book.subtitle ? (
            <p className="text-sm text-ink-soft">{book.subtitle}</p>
          ) : null}
          <p className="text-sm font-medium text-ink-soft">
            {book.authors.length ? book.authors.join(", ") : "Auteur inconnu"}
          </p>
          <p className="text-xs text-ink-faint">
            {[
              book.published_year ? `${book.published_year}` : null,
              book.page_count ? `${book.page_count} pages` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {book.genres.length ? (
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pt-1">
              {book.genres.map((genre) => (
                <Link
                  key={genre.slug}
                  href={`/decouvrir?genre=${genre.slug}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-surface-muted"
                >
                  <span aria-hidden>{genre.emoji}</span>
                  {genre.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {book.description ? <BookSynopsis text={book.description} /> : null}

      <BookActions bookId={book.id} />
      <BookSocialActions bookId={book.id} bookTitle={book.title} />

      <BookRatingBreakdown bookId={book.id} className="bc-card p-4" />

      <section aria-label="Avis" className="space-y-3">
        <h2 className="font-display text-lg font-bold">Avis des lecteurs</h2>
        <ReviewList bookId={book.id} />
      </section>

      {similar.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Dans le même esprit</h2>
          <RecommendationRail label="Dans le même esprit" items={similar} />
        </section>
      ) : null}
    </div>
  );
}
