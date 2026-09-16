import Link from "next/link";
import { BookCover } from "./BookCover";
import { StarsDisplay } from "@/components/ui/Stars";
import { IconCheck } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

export type BookCardBook = {
  id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  published_year?: number | null;
};

/** Carte livre : le composant le plus réutilisé du site. */
export function BookCard({
  book,
  rating,
  ratingsCount,
  inLibrary,
  badge,
  className,
  priority,
}: {
  book: BookCardBook;
  rating?: number | null;
  ratingsCount?: number;
  inLibrary?: boolean;
  badge?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/livre/${book.id}`}
      className={cn("bc-glow group block focus-visible:outline-offset-4", className)}
    >
      <div className="relative">
        <BookCover
          title={book.title}
          authors={book.authors}
          url={book.cover_url}
          priority={priority}
        />
        {inLibrary ? (
          <span
            title="Dans votre bibliothèque"
            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-success text-white shadow-tiny"
          >
            <IconCheck className="h-4 w-4" />
            <span className="sr-only">Dans votre bibliothèque</span>
          </span>
        ) : null}
        {badge ? (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-violet-950/85 px-2 py-0.5 text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-snug line-clamp-2-safe group-hover:text-primary">
        {book.title}
      </h3>
      <p className="truncate text-xs text-ink-soft">
        {book.authors[0] ?? "Auteur inconnu"}
      </p>
      {rating !== undefined ? (
        <div className="mt-1">
          <StarsDisplay value={rating} count={ratingsCount} size={13} />
        </div>
      ) : null}
    </Link>
  );
}

export function BookGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  );
}

/** Rangée horizontale (carrousel) — pour « Dans le même esprit ». */
export function BookRail({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2"
    >
      {children}
    </div>
  );
}
