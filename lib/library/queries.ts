import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book, LibraryItem, Review, Shelf } from "@/types/database";
import { monthKey } from "./dates";
import type {
  BookUserState,
  LibraryEntry,
  Ownership,
  RatingDistribution,
  ReviewWithAuthor,
} from "./types";

/**
 * Toutes les lectures du lot bibliothèque.
 *
 * Parti pris : la bibliothèque personnelle tient en mémoire (quelques
 * centaines de lignes au plus). On la charge une fois, puis on filtre et on
 * agrège côté serveur. Cela évite une requête par filtre et garde les
 * compteurs d'onglets justes même quand un filtre est actif.
 */

/** Nombre de pages retenu quand l'éditeur n'en déclare pas. */
export const PAGES_PAR_DEFAUT = 300;

type Client = SupabaseClient;

/* ------------------------------------------------------------- utilitaires */

/** Normalise pour la recherche : sans accents, sans casse. */
export function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

async function currentUserId(supabase: Client): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

/** Genres (slugs) de plusieurs livres, en une requête. */
async function genresByBook(
  supabase: Client,
  bookIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (bookIds.length === 0) return map;
  const { data } = await supabase
    .from("book_genres")
    .select("book_id, genre_slug")
    .in("book_id", bookIds);
  const rows = (data ?? []) as unknown as {
    book_id: string;
    genre_slug: string;
  }[];
  for (const row of rows) {
    const list = map.get(row.book_id);
    if (list) list.push(row.genre_slug);
    else map.set(row.book_id, [row.genre_slug]);
  }
  return map;
}

/* --------------------------------------------------------- ma bibliothèque */

export interface LibrarySnapshot {
  /** Supabase non configuré : la page bascule en lecture seule. */
  demo: boolean;
  /** Aucune session : la page invite à se connecter. */
  anonymous: boolean;
  entries: LibraryEntry[];
}

const SNAPSHOT_VIDE: LibrarySnapshot = {
  demo: false,
  anonymous: false,
  entries: [],
};

/** Toute la bibliothèque de l'utilisateur connecté, livres et notes inclus. */
export async function getMyLibrary(): Promise<LibrarySnapshot> {
  const supabase = await createClient();
  if (!supabase) return { ...SNAPSHOT_VIDE, demo: true };

  const userId = await currentUserId(supabase);
  if (!userId) return { ...SNAPSHOT_VIDE, anonymous: true };

  const { data: itemsData } = await supabase
    .from("library_items")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  const items = (itemsData ?? []) as unknown as LibraryItem[];
  if (items.length === 0) return SNAPSHOT_VIDE;

  const bookIds = items.map((i) => i.book_id);

  const [{ data: booksData }, { data: ratingsData }, genres] = await Promise.all([
    supabase.from("books").select("*").in("id", bookIds),
    supabase
      .from("ratings")
      .select("book_id, rating")
      .eq("user_id", userId)
      .in("book_id", bookIds),
    genresByBook(supabase, bookIds),
  ]);

  const books = new Map(
    ((booksData ?? []) as unknown as Book[]).map((b) => [b.id, b]),
  );
  const ratings = new Map(
    ((ratingsData ?? []) as unknown as { book_id: string; rating: number }[]).map(
      (r) => [r.book_id, r.rating],
    ),
  );

  const entries: LibraryEntry[] = [];
  for (const item of items) {
    const book = books.get(item.book_id);
    // Un livre retiré du catalogue ne doit pas faire disparaître la page.
    if (!book) continue;
    entries.push({
      item,
      book,
      genres: genres.get(item.book_id) ?? [],
      my_rating: ratings.get(item.book_id) ?? null,
    });
  }
  return { demo: false, anonymous: false, entries };
}

export interface LibraryFilters {
  shelf: Shelf | null;
  genre: string | null;
  ownership: Ownership;
  q: string;
}

/** Applique les filtres de l'URL à la bibliothèque déjà chargée. */
export function filterEntries(
  entries: LibraryEntry[],
  filters: LibraryFilters,
): LibraryEntry[] {
  const needle = normalise(filters.q);
  return entries.filter((entry) => {
    if (filters.shelf && entry.item.shelf !== filters.shelf) return false;
    if (filters.genre && !entry.genres.includes(filters.genre)) return false;

    if (filters.ownership === "possede" && !entry.item.is_owned) return false;
    if (filters.ownership === "non-possede" && entry.item.is_owned) return false;
    if (filters.ownership === "pretes" && !entry.item.is_lendable) return false;

    if (needle) {
      const haystack = normalise(
        `${entry.book.title} ${entry.book.subtitle ?? ""} ${entry.book.authors.join(" ")}`,
      );
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/** Nombre de livres par étagère, tous filtres ignorés. */
export function countByShelf(entries: LibraryEntry[]): Record<Shelf, number> {
  const counts: Record<Shelf, number> = {
    wishlist: 0,
    reading: 0,
    read: 0,
    abandoned: 0,
  };
  for (const entry of entries) counts[entry.item.shelf] += 1;
  return counts;
}

/** Genres réellement présents dans la bibliothèque, du plus fourni au moins. */
export function genresPresents(entries: LibraryEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const slug of entry.genres) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slug]) => slug);
}

/* ---------------------------------------------------------- statistiques */

export interface LibraryStats {
  booksRead: number;
  pagesRead: number;
  /** Vrai si au moins un livre lu n'annonce pas sa pagination. */
  pagesEstimated: boolean;
  topGenre: { slug: string; count: number } | null;
  averageGiven: number | null;
  ratingsGiven: number;
  /** Répartition des livres lus par genre, triée. */
  byGenre: { slug: string; count: number }[];
  /** 12 derniers mois, du plus ancien au plus récent. */
  pace: { key: string; year: number; month: number; count: number }[];
  /** Livres en cours de lecture, pour la ligne d'en-tête. */
  reading: number;
  wishlist: number;
  owned: number;
  lendable: number;
}

/** Agrège la bibliothèque en chiffres présentables. */
export function computeStats(
  entries: LibraryEntry[],
  now: Date = new Date(),
): LibraryStats {
  const read = entries.filter((e) => e.item.shelf === "read");

  let pagesRead = 0;
  let pagesEstimated = false;
  for (const entry of read) {
    const pages = entry.book.page_count;
    if (pages && pages > 0) pagesRead += pages;
    else {
      pagesRead += PAGES_PAR_DEFAUT;
      pagesEstimated = true;
    }
  }

  const genreCounts = new Map<string, number>();
  for (const entry of read) {
    for (const slug of entry.genres) {
      genreCounts.set(slug, (genreCounts.get(slug) ?? 0) + 1);
    }
  }
  const byGenre = [...genreCounts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));

  const notes = entries
    .map((e) => e.my_rating)
    .filter((r): r is number => typeof r === "number");
  const averageGiven =
    notes.length > 0 ? notes.reduce((a, b) => a + b, 0) / notes.length : null;

  // Rythme : 12 fenêtres mensuelles, remplies puis comptées.
  const pace: LibraryStats["pace"] = [];
  const index = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    index.set(key, pace.length);
    pace.push({ key, year: d.getFullYear(), month: d.getMonth(), count: 0 });
  }
  for (const entry of read) {
    // `finished_at` fait foi ; sinon on retombe sur la date d'ajout.
    const raw = entry.item.finished_at ?? entry.item.added_at;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    const slot = index.get(monthKey(date));
    if (slot !== undefined) pace[slot].count += 1;
  }

  return {
    booksRead: read.length,
    pagesRead,
    pagesEstimated,
    topGenre: byGenre[0] ?? null,
    averageGiven,
    ratingsGiven: notes.length,
    byGenre,
    pace,
    reading: entries.filter((e) => e.item.shelf === "reading").length,
    wishlist: entries.filter((e) => e.item.shelf === "wishlist").length,
    owned: entries.filter((e) => e.item.is_owned).length,
    lendable: entries.filter((e) => e.item.is_lendable).length,
  };
}

/* ------------------------------------------------- état d'un livre donné */

const ETAT_VIDE: BookUserState = {
  demo: false,
  anonymous: false,
  shelf: null,
  is_owned: false,
  is_lendable: false,
  rating: null,
  review: null,
};

/** Ce que l'utilisateur connecté a déjà fait de ce livre. */
export async function getBookUserState(bookId: string): Promise<BookUserState> {
  const supabase = await createClient();
  if (!supabase) return { ...ETAT_VIDE, demo: true };

  const userId = await currentUserId(supabase);
  if (!userId) return { ...ETAT_VIDE, anonymous: true };

  const [{ data: itemData }, { data: ratingData }, { data: reviewData }] =
    await Promise.all([
      supabase
        .from("library_items")
        .select("*")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .maybeSingle(),
      supabase
        .from("ratings")
        .select("rating")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .maybeSingle(),
      supabase
        .from("reviews")
        .select("id, body, has_spoiler")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .maybeSingle(),
    ]);

  const item = (itemData ?? null) as unknown as LibraryItem | null;
  const rating = (ratingData ?? null) as unknown as { rating: number } | null;
  const review = (reviewData ?? null) as unknown as BookUserState["review"];

  return {
    demo: false,
    anonymous: false,
    shelf: item?.shelf ?? null,
    is_owned: item?.is_owned ?? false,
    is_lendable: item?.is_lendable ?? false,
    rating: rating?.rating ?? null,
    review,
  };
}

/* ------------------------------------------------------------------- avis */

/** Fil des avis d'un livre, avec auteurs, notes et « Utile ». */
export async function getBookReviews(
  bookId: string,
): Promise<{ demo: boolean; anonymous: boolean; reviews: ReviewWithAuthor[] }> {
  const supabase = await createClient();
  if (!supabase) return { demo: true, anonymous: true, reviews: [] };

  const me = await currentUserId(supabase);

  const { data: reviewsData } = await supabase
    .from("reviews")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  const reviews = (reviewsData ?? []) as unknown as Review[];
  const anonymous = me === null;
  if (reviews.length === 0) return { demo: false, anonymous, reviews: [] };

  const userIds = [...new Set(reviews.map((r) => r.user_id))];
  const reviewIds = reviews.map((r) => r.id);

  const [{ data: profilesData }, { data: ratingsData }, { data: likesData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds),
      supabase
        .from("ratings")
        .select("user_id, rating")
        .eq("book_id", bookId)
        .in("user_id", userIds),
      supabase
        .from("review_likes")
        .select("review_id, user_id")
        .in("review_id", reviewIds),
    ]);

  const profiles = new Map(
    (
      (profilesData ?? []) as unknown as ReviewWithAuthor["author"][]
    ).map((p) => [p.id, p]),
  );
  const ratings = new Map(
    (
      (ratingsData ?? []) as unknown as { user_id: string; rating: number }[]
    ).map((r) => [r.user_id, r.rating]),
  );

  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const like of (likesData ?? []) as unknown as {
    review_id: string;
    user_id: string;
  }[]) {
    likeCounts.set(like.review_id, (likeCounts.get(like.review_id) ?? 0) + 1);
    if (me && like.user_id === me) likedByMe.add(like.review_id);
  }

  return {
    demo: false,
    anonymous,
    reviews: reviews.map((review) => ({
      id: review.id,
      book_id: review.book_id,
      body: review.body,
      has_spoiler: review.has_spoiler,
      created_at: review.created_at,
      updated_at: review.updated_at,
      author: profiles.get(review.user_id) ?? {
        id: review.user_id,
        username: "membre",
        display_name: "Membre Bookclub",
        avatar_url: null,
      },
      author_rating: ratings.get(review.user_id) ?? null,
      likes_count: likeCounts.get(review.id) ?? 0,
      liked_by_me: likedByMe.has(review.id),
      mine: me === review.user_id,
    })),
  };
}

/* ---------------------------------------------------- répartition de notes */

const DISTRIBUTION_VIDE: RatingDistribution = {
  counts: [0, 0, 0, 0, 0],
  total: 0,
  average: null,
};

/** Répartition des notes d'un livre, pour `RatingBreakdown`. */
export async function getRatingDistribution(
  bookId: string,
): Promise<RatingDistribution> {
  const supabase = await createClient();
  if (!supabase) return DISTRIBUTION_VIDE;

  const { data } = await supabase
    .from("ratings")
    .select("rating")
    .eq("book_id", bookId);

  const rows = (data ?? []) as unknown as { rating: number }[];
  if (rows.length === 0) return DISTRIBUTION_VIDE;

  const counts: RatingDistribution["counts"] = [0, 0, 0, 0, 0];
  let somme = 0;
  for (const row of rows) {
    const n = Math.round(row.rating);
    if (n < 1 || n > 5) continue;
    counts[n - 1] += 1;
    somme += n;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  return {
    counts,
    total,
    average: total > 0 ? somme / total : null,
  };
}
