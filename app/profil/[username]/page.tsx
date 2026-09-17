import type { Metadata } from "next";
import Link from "next/link";
import { BookCard, BookGrid } from "@/components/books/BookCard";
import { FriendButton } from "@/components/social/FriendButton";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { EmptyState } from "@/components/ui/States";
import { StarsDisplay } from "@/components/ui/Stars";
import { DEMO_AUTH_MESSAGE } from "@/lib/auth/messages";
import { normalizeUsername } from "@/lib/auth/validation";
import { GENRE_BY_SLUG, genreLabel } from "@/lib/data/genres";
import { createClient } from "@/lib/supabase/server";
import { SHELF_LABELS, type Profile, type Shelf } from "@/types/database";

type BookLite = {
  id: string;
  title: string;
  authors: string[] | null;
  cover_url: string | null;
};

type ItemRow = {
  book_id: string;
  shelf: Shelf;
  added_at: string;
  finished_at: string | null;
  books: BookLite | BookLite[] | null;
};

type ReviewRow = {
  id: string;
  body: string;
  has_spoiler: boolean;
  created_at: string;
  book_id: string;
  books: BookLite | BookLite[] | null;
};

/** Une relation intégrée arrive tantôt en objet, tantôt en tableau. */
function firstBook(value: BookLite | BookLite[] | null): BookLite | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const pseudo = normalizeUsername(decodeURIComponent(username));
  return {
    title: `@${pseudo}`,
    description: `Les lectures, les notes et les avis de @${pseudo} sur Bookclub.`,
  };
}

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: raw } = await params;
  const username = normalizeUsername(decodeURIComponent(raw));
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="space-y-4 py-4">
        <DemoNotice />
        <p className="text-sm text-ink-soft">{DEMO_AUTH_MESSAGE}</p>
      </div>
    );
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  const profile = profileRow as Profile | null;

  // Profil absent ou masqué par les politiques RLS : même écran, sans erreur.
  if (!profile) return <HiddenProfile username={username} />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  const [itemsResult, ratingsResult, reviewsResult] = await Promise.all([
    supabase
      .from("library_items")
      .select("book_id, shelf, added_at, finished_at, books(id, title, authors, cover_url)")
      .eq("user_id", profile.id)
      .order("added_at", { ascending: false })
      .limit(60),
    supabase.from("ratings").select("book_id, rating").eq("user_id", profile.id),
    supabase
      .from("reviews")
      .select("id, body, has_spoiler, created_at, book_id, books(id, title, authors, cover_url)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const items: ItemRow[] = itemsResult.data ?? [];
  const ratings: Array<{ book_id: string; rating: number }> =
    ratingsResult.data ?? [];
  const reviews: ReviewRow[] = reviewsResult.data ?? [];

  const readItems = items.filter((item) => item.shelf === "read");
  const averageGiven =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : null;

  // Genre le plus lu : calculé sur les livres de l'étagère « Lu ».
  let topGenre: string | null = null;
  if (readItems.length > 0) {
    const { data: genreRows } = await supabase
      .from("book_genres")
      .select("genre_slug")
      .in(
        "book_id",
        readItems.map((item) => item.book_id),
      );
    const counts = new Map<string, number>();
    for (const row of (genreRows ?? []) as Array<{ genre_slug: string }>) {
      counts.set(row.genre_slug, (counts.get(row.genre_slug) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) topGenre = genreLabel(best[0]);
  }

  const nothingVisible =
    items.length === 0 && reviews.length === 0 && ratings.length === 0;
  const isHidden = !profile.is_public && !isOwner && nothingVisible;

  const displayName = profile.display_name || profile.username;
  const latest = items.slice(0, 6);

  return (
    <div className="space-y-6 py-4">
      <Card className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar name={displayName} url={profile.avatar_url} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
              {displayName}
            </h1>
            <p className="text-sm text-ink-soft">@{profile.username}</p>
            {!profile.is_public ? (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-soft">
                <span aria-hidden>🔒</span> Profil privé
              </p>
            ) : null}
          </div>
        </div>

        {profile.bio ? (
          <p className="text-sm leading-relaxed text-ink-soft">{profile.bio}</p>
        ) : null}

        {profile.favorite_genres?.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Genres préférés">
            {profile.favorite_genres.map((slug) => (
              <li
                key={slug}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 text-sm text-ink-soft"
              >
                <span aria-hidden>{GENRE_BY_SLUG.get(slug)?.emoji ?? "📘"}</span>
                {genreLabel(slug)}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <ButtonLink href="/reglages" variant="secondary" size="sm">
              Modifier mon profil
            </ButtonLink>
          ) : (
            <FriendButton profileId={profile.id} username={profile.username} />
          )}
        </div>
      </Card>

      {isHidden ? (
        <EmptyState
          emoji="🔒"
          title="Ce profil est privé"
          description={`${displayName} réserve ses lectures à ses amis et aux membres de ses communautés. Envoyez une demande d'ami pour les découvrir.`}
        />
      ) : (
        <>
          <section aria-label="Statistiques de lecture">
            <div className="grid grid-cols-3 gap-3">
              <StatTile
                label="Livres lus"
                value={readItems.length > 0 ? String(readItems.length) : "—"}
              />
              <StatTile
                label="Note moyenne"
                value={
                  averageGiven !== null ? (
                    <StarsDisplay value={Number(averageGiven.toFixed(1))} size={13} />
                  ) : (
                    "—"
                  )
                }
              />
              <StatTile label="Genre le plus lu" value={topGenre ?? "—"} />
            </div>
          </section>

          <section aria-label="Dernières lectures">
            <SectionTitle
              title="Dernières lectures"
              subtitle={
                latest.length > 0 ? undefined : "Rien à afficher pour l'instant."
              }
            />
            {latest.length > 0 ? (
              <BookGrid>
                {latest.map((item) => {
                  const book = firstBook(item.books);
                  if (!book) return null;
                  return (
                    <BookCard
                      key={item.book_id}
                      book={{
                        id: book.id,
                        title: book.title,
                        authors: book.authors ?? [],
                        cover_url: book.cover_url,
                      }}
                      badge={SHELF_LABELS[item.shelf]}
                    />
                  );
                })}
              </BookGrid>
            ) : (
              <EmptyState
                emoji="📚"
                title={
                  isOwner
                    ? "Votre bibliothèque est encore vide"
                    : "Aucune lecture partagée"
                }
                description={
                  isOwner
                    ? "Ajoutez un premier livre : le reste suivra tout seul."
                    : "Ce membre n'a pas encore de livre visible ici."
                }
                actionLabel={isOwner ? "Découvrir des livres" : undefined}
                actionHref={isOwner ? "/decouvrir" : undefined}
              />
            )}
          </section>

          <section aria-label="Derniers avis">
            <SectionTitle title="Derniers avis" />
            {reviews.length > 0 ? (
              <ul className="space-y-3">
                {reviews.map((review) => {
                  const book = firstBook(review.books);
                  return (
                    <li key={review.id}>
                      <Card className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link
                            href={`/livre/${review.book_id}`}
                            className="font-semibold hover:text-primary"
                          >
                            {book?.title ?? "Livre"}
                          </Link>
                          <span className="shrink-0 text-xs text-ink-faint">
                            {formatDate(review.created_at)}
                          </span>
                        </div>
                        {review.has_spoiler ? (
                          <details className="text-sm text-ink-soft">
                            <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-accent">
                              Contient un spoiler — afficher quand même
                            </summary>
                            <p className="pt-1 leading-relaxed">{review.body}</p>
                          </details>
                        ) : (
                          <p className="text-sm leading-relaxed text-ink-soft">
                            {review.body}
                          </p>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                emoji="✍️"
                title="Pas encore d'avis"
                description={
                  isOwner
                    ? "Votre premier avis aidera d'autres lecteurs à choisir."
                    : "Ce membre n'a pas encore publié d'avis."
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bc-card flex flex-col items-center gap-1 px-2 py-4 text-center">
      <span className="font-display text-lg font-bold leading-tight">
        {value}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </span>
    </div>
  );
}

/** Profil inexistant ou réservé : un état soigné, jamais une page d'erreur. */
function HiddenProfile({ username }: { username: string }) {
  return (
    <div className="py-8">
      <EmptyState
        emoji="🔒"
        title={`@${username} ne se montre pas`}
        description="Ce profil n'existe pas, ou son propriétaire le réserve à ses amis et aux membres de ses communautés."
        actionLabel="Explorer le catalogue"
        actionHref="/decouvrir"
      />
    </div>
  );
}
