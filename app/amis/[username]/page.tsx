import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { BookCover } from "@/components/books/BookCover";
import { ChipLink, ChipRow } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/States";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { LoanRequestDialog } from "@/components/social/LoanRequestDialog";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  getBlockedCopies,
  getProfileByUsername,
  getSharedShelf,
  personName,
} from "@/lib/social/queries";
import { genreLabel } from "@/lib/data/genres";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `Bibliothèque de ${username}` };
}

export default async function BibliothequeAmiPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ genre?: string }>;
}) {
  const { username } = await params;
  const { genre } = await searchParams;

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="space-y-4 py-4">
        <h1 className="font-display text-xl font-extrabold">Bibliothèque</h1>
        <DemoNotice />
      </div>
    );
  }

  const [friend, me] = await Promise.all([
    getProfileByUsername(supabase, username),
    getCurrentUser(),
  ]);

  // RLS renvoie simplement « rien trouvé » pour un profil privé ou inconnu :
  // on ne peut pas distinguer les deux, et on ne doit pas le faire.
  if (!friend) notFound();

  const shelf = await getSharedShelf(supabase, [friend.id], { limit: 300 });
  const blocked = me ? await getBlockedCopies(supabase, shelf.map((e) => e.book.id)) : new Set<string>();

  const genres = [...new Set(shelf.flatMap((e) => e.genres))].sort((a, b) =>
    genreLabel(a).localeCompare(genreLabel(b), "fr"),
  );
  const items = genre ? shelf.filter((e) => e.genres.includes(genre)) : shelf;
  const lendable = items.filter((e) => e.is_lendable);

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-3">
        <Avatar name={personName(friend)} url={friend.avatar_url} size={52} />
        <div>
          <h1 className="font-display text-xl font-extrabold sm:text-2xl">
            Bibliothèque de {personName(friend)}
          </h1>
          <Link
            href={`/profil/${friend.username}`}
            className="text-sm text-primary hover:underline"
          >
            Voir le profil
          </Link>
        </div>
      </div>

      {shelf.length === 0 ? (
        <EmptyState
          emoji="🔒"
          title="Rien à afficher ici"
          description="Soit cette bibliothèque est vide, soit elle n'est pas partagée avec vous."
        />
      ) : (
        <>
          {genres.length > 1 ? (
            <ChipRow label="Filtrer par genre">
              <ChipLink href={`/amis/${username}`} active={!genre}>
                Tous
              </ChipLink>
              {genres.map((slug) => (
                <ChipLink key={slug} href={`/amis/${username}?genre=${slug}`} active={genre === slug}>
                  {genreLabel(slug)}
                </ChipLink>
              ))}
            </ChipRow>
          ) : null}

          {lendable.length ? (
            <section className="space-y-2.5">
              <h2 className="font-display text-lg font-bold">Disponibles à l&apos;emprunt</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {lendable.map((entry) => (
                  <li key={entry.book.id} className="space-y-1.5">
                    <Link href={`/livre/${entry.book.id}`}>
                      <BookCover title={entry.book.title} url={entry.book.cover_url} />
                    </Link>
                    <p className="truncate text-xs font-semibold">{entry.book.title}</p>
                    {me && me.id !== friend.id ? (
                      <LoanRequestDialog
                        bookId={entry.book.id}
                        bookTitle={entry.book.title}
                        owners={[
                          {
                            profile: friend,
                            unavailable: blocked.has(`${entry.book.id}:${friend.id}`),
                            via: "ami",
                          },
                        ]}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2.5">
            <h2 className="font-display text-lg font-bold">Toute la bibliothèque</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((entry) => (
                <Link key={entry.book.id} href={`/livre/${entry.book.id}`}>
                  <BookCover title={entry.book.title} url={entry.book.cover_url} />
                  <p className="mt-1 truncate text-xs font-semibold">{entry.book.title}</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
