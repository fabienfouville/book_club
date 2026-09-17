import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Book,
  BookStats,
  BookWithContext,
  Genre,
  LibraryItem,
  RecommendedBook,
} from "@/types/database";
import { GENRE_BY_SLUG } from "@/lib/data/genres";
import type { Sort, Ownership } from "./catalogue-constants";
import {
  DEMO_BOOKS,
  DEMO_BY_ID,
  demoDistribution,
  demoPopular,
  demoSimilar,
  demoTopRated,
  type DemoEntry,
} from "./demo";
import {
  buildReason,
  buildSimilarReason,
  callRecommendationRpc,
  recommendArgs,
  similarArgs,
} from "@/lib/recommendations";

/**
 * Couche de lecture du catalogue : **toutes** les pages passent par ici.
 * Chaque fonction sait fonctionner sans Supabase (mode démonstration) et ne
 * lève jamais : une page doit pouvoir s'afficher même si la base tousse.
 */

/* ------------------------------------------------------------- contrats --- */

export {
  SORTS,
  SORT_LABELS,
  OWNERSHIPS,
  OWNERSHIP_LABELS,
  parseSort,
  parseOwnership,
} from "./catalogue-constants";
export type { Sort, Ownership } from "./catalogue-constants";

/** Un livre tel que consommé par les grilles et les rails. */
export interface CatalogueBook {
  book: Book;
  genre_slugs: string[];
  stats: BookStats;
  in_library: boolean;
}

export interface ListBooksParams {
  q?: string;
  genres?: string[];
  sort?: Sort;
  ownership?: Ownership;
  userId?: string | null;
  limit?: number;
  offset?: number;
}

export interface BookList {
  items: CatalogueBook[];
  /** Nombre total de résultats quand la base peut le compter, sinon `null`. */
  total: number | null;
  hasMore: boolean;
  demo: boolean;
}

/** Vrai quand le site tourne sans base de données. */
export function isDemoMode() {
  return !isSupabaseConfigured;
}

/* ------------------------------------------------------------- utilitaires */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_RE.test(value.trim());
}

/** Fenêtre de candidats quand le tri se fait sur des statistiques agrégées. */
const STATS_WINDOW = 400;

function emptyStats(bookId: string): BookStats {
  return {
    book_id: bookId,
    average_rating: null,
    ratings_count: 0,
    reviews_count: 0,
    owners_count: 0,
    readers_count: 0,
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Neutralise ce qui casserait la syntaxe `or()` de PostgREST. */
function sanitizeQuery(value: string) {
  return value.replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

type Rec = Record<string, unknown>;

function asRecord(value: unknown): Rec | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Conversion défensive d'une ligne `books` : la base n'est pas typée ici. */
function coerceBook(value: unknown): Book | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = text(row.id);
  const title = text(row.title);
  if (!id || !title) return null;

  return {
    id,
    source: (text(row.source) ?? "manual") as Book["source"],
    source_id: text(row.source_id),
    isbn13: text(row.isbn13),
    title,
    subtitle: text(row.subtitle),
    authors: Array.isArray(row.authors)
      ? row.authors.filter((a): a is string => typeof a === "string")
      : [],
    cover_url: text(row.cover_url),
    description: text(row.description),
    published_year: numberOrNull(row.published_year),
    page_count: numberOrNull(row.page_count),
    language: text(row.language),
    added_by: text(row.added_by),
    created_at: text(row.created_at) ?? new Date(0).toISOString(),
  };
}

function coerceStats(value: unknown): BookStats | null {
  const row = asRecord(value);
  const bookId = row ? text(row.book_id) : null;
  if (!row || !bookId) return null;
  return {
    book_id: bookId,
    average_rating: numberOrNull(row.average_rating),
    ratings_count: numberOrNull(row.ratings_count) ?? 0,
    reviews_count: numberOrNull(row.reviews_count) ?? 0,
    owners_count: numberOrNull(row.owners_count) ?? 0,
    readers_count: numberOrNull(row.readers_count) ?? 0,
  };
}

function coerceLibraryItem(value: unknown): LibraryItem | null {
  const row = asRecord(value);
  if (!row) return null;
  const userId = text(row.user_id);
  const bookId = text(row.book_id);
  if (!userId || !bookId) return null;
  return {
    user_id: userId,
    book_id: bookId,
    shelf: (text(row.shelf) ?? "wishlist") as LibraryItem["shelf"],
    is_owned: row.is_owned === true,
    is_lendable: row.is_lendable === true,
    notes: text(row.notes),
    added_at: text(row.added_at) ?? new Date(0).toISOString(),
    finished_at: text(row.finished_at),
  };
}

export function genreFromSlug(slug: string): Genre {
  return (
    GENRE_BY_SLUG.get(slug) ?? { slug, label: slug, emoji: "📚", sort_order: 99 }
  );
}

function demoToCatalogueBook(entry: DemoEntry): CatalogueBook {
  return {
    book: entry.book,
    genre_slugs: entry.genre_slugs,
    stats: entry.stats,
    in_library: false,
  };
}

/* ------------------------------------------------------ accès Supabase ---- */

/** Identifiants des livres déjà rangés dans la bibliothèque de l'utilisateur. */
async function fetchLibraryIds(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const { data, error } = await supabase
      .from("library_items")
      .select("book_id")
      .eq("user_id", userId)
      .limit(2000);
    if (error || !data) return new Set();
    const ids = new Set<string>();
    for (const row of data as unknown[]) {
      const id = text(asRecord(row)?.book_id);
      if (id) ids.add(id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

/** Genres de plusieurs livres, en un appel. */
async function fetchGenreMap(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!ids.length) return map;
  try {
    const { data, error } = await supabase
      .from("book_genres")
      .select("book_id, genre_slug")
      .in("book_id", ids);
    if (error || !data) return map;
    for (const row of data as unknown[]) {
      const record = asRecord(row);
      const bookId = text(record?.book_id);
      const slug = text(record?.genre_slug);
      if (!bookId || !slug) continue;
      const current = map.get(bookId) ?? [];
      current.push(slug);
      map.set(bookId, current);
    }
  } catch {
    // Sans genres, la carte reste lisible : on n'insiste pas.
  }
  return map;
}

/**
 * Statistiques publiques. On lit la vue agrégée `book_stats` ; si elle n'existe
 * pas encore, on recalcule l'essentiel depuis `ratings`.
 */
async function fetchStatsMap(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, BookStats>> {
  const map = new Map<string, BookStats>();
  if (!ids.length) return map;

  try {
    const { data, error } = await supabase.from("book_stats").select("*").in("book_id", ids);
    if (!error && data) {
      for (const row of data as unknown[]) {
        const stats = coerceStats(row);
        if (stats) map.set(stats.book_id, stats);
      }
      if (map.size) return map;
    }
  } catch {
    // On tente le repli ci-dessous.
  }

  try {
    const { data } = await supabase
      .from("ratings")
      .select("book_id, rating")
      .in("book_id", ids)
      .limit(5000);
    const sums = new Map<string, { total: number; count: number }>();
    for (const row of (data ?? []) as unknown[]) {
      const record = asRecord(row);
      const bookId = text(record?.book_id);
      const rating = numberOrNull(record?.rating);
      if (!bookId || rating === null) continue;
      const current = sums.get(bookId) ?? { total: 0, count: 0 };
      current.total += rating;
      current.count += 1;
      sums.set(bookId, current);
    }
    for (const [bookId, { total, count }] of sums) {
      map.set(bookId, {
        ...emptyStats(bookId),
        average_rating: count ? Math.round((total / count) * 10) / 10 : null,
        ratings_count: count,
      });
    }
  } catch {
    // Tant pis : les livres s'afficheront sans note.
  }

  return map;
}

/** Livres par identifiants, dans une seule requête. */
async function fetchBooksByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, Book>> {
  const map = new Map<string, Book>();
  const valid = ids.filter(isUuid);
  if (!valid.length) return map;
  try {
    const { data, error } = await supabase.from("books").select("*").in("id", valid);
    if (error || !data) return map;
    for (const row of data as unknown[]) {
      const book = coerceBook(row);
      if (book) map.set(book.id, book);
    }
  } catch {
    // Map vide : l'appelant affichera un état vide.
  }
  return map;
}

/** Assemble livres + genres + stats + appartenance à la bibliothèque. */
async function decorate(
  supabase: SupabaseClient,
  books: Book[],
  libraryIds: Set<string>,
): Promise<CatalogueBook[]> {
  const ids = books.map((b) => b.id);
  const [genreMap, statsMap] = await Promise.all([
    fetchGenreMap(supabase, ids),
    fetchStatsMap(supabase, ids),
  ]);
  return books.map((book) => ({
    book,
    genre_slugs: genreMap.get(book.id) ?? [],
    stats: statsMap.get(book.id) ?? emptyStats(book.id),
    in_library: libraryIds.has(book.id),
  }));
}

/* ------------------------------------------------------------ listBooks --- */

function sortDemo(entries: DemoEntry[], sort: Sort): DemoEntry[] {
  const copy = [...entries];
  switch (sort) {
    case "titre":
      return copy.sort((a, b) => a.book.title.localeCompare(b.book.title, "fr"));
    case "recent":
      return copy.sort((a, b) => b.book.created_at.localeCompare(a.book.created_at));
    case "mieux-note":
      return copy.sort(
        (a, b) => (b.stats.average_rating ?? 0) - (a.stats.average_rating ?? 0),
      );
    case "populaire":
    default:
      return copy.sort((a, b) => b.stats.ratings_count - a.stats.ratings_count);
  }
}

function listBooksDemo(params: ListBooksParams): BookList {
  const limit = params.limit ?? 24;
  const offset = params.offset ?? 0;
  const needle = params.q ? normalizeText(params.q.trim()) : "";
  const genres = params.genres ?? [];
  const ownership = params.ownership ?? "tous";

  let entries = DEMO_BOOKS;

  if (needle) {
    entries = entries.filter((entry) => {
      const haystack = normalizeText(
        `${entry.book.title} ${entry.book.authors.join(" ")} ${entry.book.description ?? ""}`,
      );
      return haystack.includes(needle);
    });
  }
  if (genres.length) {
    entries = entries.filter((entry) => entry.genre_slugs.some((slug) => genres.includes(slug)));
  }
  // En démonstration, personne n'a de bibliothèque : le filtre reste cohérent.
  if (ownership === "dans-ma-biblio") entries = [];

  const sorted = sortDemo(entries, params.sort ?? "populaire");
  const page = sorted.slice(offset, offset + limit);

  return {
    items: page.map(demoToCatalogueBook),
    total: sorted.length,
    hasMore: offset + limit < sorted.length,
    demo: true,
  };
}

/**
 * Liste principale du catalogue : recherche, filtres de genre, filtre
 * « dans ma bibliothèque / les autres », tri et pagination.
 */
export async function listBooks(params: ListBooksParams = {}): Promise<BookList> {
  const limit = Math.min(Math.max(params.limit ?? 24, 1), 60);
  const offset = Math.max(params.offset ?? 0, 0);
  const sort = params.sort ?? "populaire";
  const ownership = params.ownership ?? "tous";
  const genres = (params.genres ?? []).filter((slug) => GENRE_BY_SLUG.has(slug));

  let supabase: SupabaseClient | null = null;
  try {
    supabase = await createClient();
  } catch {
    supabase = null;
  }
  if (!supabase) return listBooksDemo({ ...params, limit, offset, sort, ownership, genres });

  try {
    const libraryIds = await fetchLibraryIds(supabase, params.userId);

    // Le filtre d'appartenance n'a de sens qu'avec une bibliothèque connue.
    if (ownership === "dans-ma-biblio" && libraryIds.size === 0) {
      return { items: [], total: 0, hasMore: false, demo: false };
    }

    const statsSort = sort === "populaire" || sort === "mieux-note";
    const select = genres.length ? "*, book_genres!inner(genre_slug)" : "*";

    let query = supabase
      .from("books")
      .select(select, statsSort ? undefined : { count: "estimated" });

    const needle = params.q ? sanitizeQuery(params.q) : "";
    if (needle) {
      // `authors` est un tableau : PostgREST ne sait y chercher qu'un élément
      // entier, d'où la recherche complémentaire sur le titre et le résumé.
      query = query.or(
        `title.ilike.%${needle}%,subtitle.ilike.%${needle}%,description.ilike.%${needle}%,authors.cs.{"${needle}"}`,
      );
    }
    if (genres.length) {
      query = query.in("book_genres.genre_slug", genres);
    }
    if (ownership === "dans-ma-biblio") {
      query = query.in("id", [...libraryIds]);
    } else if (ownership === "hors-ma-biblio" && libraryIds.size) {
      query = query.not("id", "in", `(${[...libraryIds].join(",")})`);
    }

    if (statsSort) {
      // Le tri dépend d'agrégats : on prend une fenêtre de candidats récents,
      // puis on trie en mémoire. Largement suffisant à l'échelle d'un club.
      query = query.order("created_at", { ascending: false }).limit(STATS_WINDOW);
    } else if (sort === "titre") {
      query = query.order("title", { ascending: true }).range(offset, offset + limit - 1);
    } else {
      query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;
    if (error) {
      console.warn("[catalogue] listBooks :", error.message);
      return { items: [], total: 0, hasMore: false, demo: false };
    }

    const books: Book[] = [];
    for (const row of (data ?? []) as unknown[]) {
      const book = coerceBook(row);
      if (book) books.push(book);
    }

    if (!statsSort) {
      const items = await decorate(supabase, books, libraryIds);
      const total = typeof count === "number" ? count : null;
      return {
        items,
        total,
        hasMore: total === null ? books.length === limit : offset + limit < total,
        demo: false,
      };
    }

    const decorated = await decorate(supabase, books, libraryIds);
    decorated.sort((a, b) =>
      sort === "mieux-note"
        ? (b.stats.average_rating ?? 0) - (a.stats.average_rating ?? 0) ||
          b.stats.ratings_count - a.stats.ratings_count
        : b.stats.ratings_count - a.stats.ratings_count ||
          (b.stats.average_rating ?? 0) - (a.stats.average_rating ?? 0),
    );

    return {
      items: decorated.slice(offset, offset + limit),
      total: decorated.length,
      hasMore: offset + limit < decorated.length,
      demo: false,
    };
  } catch (error) {
    console.warn("[catalogue] listBooks a échoué :", error);
    return { items: [], total: 0, hasMore: false, demo: false };
  }
}

/* -------------------------------------------------- getBookWithContext ---- */

function demoContext(entry: DemoEntry): BookWithContext {
  return {
    ...entry.book,
    genres: entry.genre_slugs.map(genreFromSlug),
    stats: entry.stats,
    library_item: null,
    my_rating: null,
  };
}

/** Fiche livre complète : livre + genres + stats + contexte de l'utilisateur. */
export async function getBookWithContext(
  id: string,
  userId?: string | null,
): Promise<BookWithContext | null> {
  let supabase: SupabaseClient | null = null;
  try {
    supabase = await createClient();
  } catch {
    supabase = null;
  }

  if (!supabase) {
    const entry = DEMO_BY_ID.get(id);
    return entry ? demoContext(entry) : null;
  }
  if (!isUuid(id)) return null;

  try {
    const { data, error } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    const book = coerceBook(data);
    if (!book) return null;

    const [genreMap, statsMap] = await Promise.all([
      fetchGenreMap(supabase, [book.id]),
      fetchStatsMap(supabase, [book.id]),
    ]);

    let libraryItem: LibraryItem | null = null;
    let myRating: number | null = null;

    if (userId) {
      const [itemResult, ratingResult] = await Promise.all([
        supabase
          .from("library_items")
          .select("*")
          .eq("user_id", userId)
          .eq("book_id", book.id)
          .maybeSingle(),
        supabase
          .from("ratings")
          .select("rating")
          .eq("user_id", userId)
          .eq("book_id", book.id)
          .maybeSingle(),
      ]);
      libraryItem = coerceLibraryItem(itemResult.data);
      myRating = numberOrNull(asRecord(ratingResult.data)?.rating);
    }

    return {
      ...book,
      genres: (genreMap.get(book.id) ?? []).map(genreFromSlug),
      stats: statsMap.get(book.id) ?? emptyStats(book.id),
      library_item: libraryItem,
      my_rating: myRating,
    };
  } catch (error) {
    console.warn("[catalogue] getBookWithContext a échoué :", error);
    return null;
  }
}

/** Répartition des notes, de 1 à 5 étoiles (index 0 = une étoile). */
export async function getRatingDistribution(bookId: string): Promise<number[]> {
  let supabase: SupabaseClient | null = null;
  try {
    supabase = await createClient();
  } catch {
    supabase = null;
  }
  if (!supabase) return demoDistribution(bookId);
  if (!isUuid(bookId)) return [0, 0, 0, 0, 0];

  try {
    const { data, error } = await supabase
      .from("ratings")
      .select("rating")
      .eq("book_id", bookId)
      .limit(5000);
    if (error || !data) return [0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0];
    for (const row of data as unknown[]) {
      const rating = numberOrNull(asRecord(row)?.rating);
      if (rating && rating >= 1 && rating <= 5) counts[rating - 1] += 1;
    }
    return counts;
  } catch {
    return [0, 0, 0, 0, 0];
  }
}

/* ------------------------------------------------------- recommandations --- */

function demoSimilarBooks(bookId: string, limit: number): RecommendedBook[] {
  return demoSimilar(bookId, limit).map(({ entry, shared }) => ({
    book: entry.book,
    score: shared.length,
    reason: shared.length
      ? buildSimilarReason("genre", shared[0])
      : buildSimilarReason("author", entry.book.authors[0] ?? null),
  }));
}

/**
 * Bloc « Dans le même esprit » : fonction SQL `similar_books`, avec un repli
 * sur les genres partagés si la fonction n'est pas (encore) déployée.
 */
export async function getSimilarBooks(
  bookId: string,
  limit = 10,
): Promise<RecommendedBook[]> {
  let supabase: SupabaseClient | null = null;
  try {
    supabase = await createClient();
  } catch {
    supabase = null;
  }
  if (!supabase) return demoSimilarBooks(bookId, limit);
  if (!isUuid(bookId)) return [];

  try {
    const rows = await callRecommendationRpc(
      supabase,
      "similar_books",
      similarArgs(bookId, limit),
    );

    if (rows?.length) {
      const ids = rows.map((row) => row.book_id).slice(0, limit);
      const books = await fetchBooksByIds(supabase, ids);
      const out: RecommendedBook[] = [];
      for (const row of rows.slice(0, limit)) {
        const book = books.get(row.book_id);
        if (!book) continue;
        out.push({
          book,
          score: row.score,
          reason: buildSimilarReason(row.reason_kind, row.reason_label),
        });
      }
      if (out.length) return out;
    }

    return await similarByGenres(supabase, bookId, limit);
  } catch (error) {
    console.warn("[catalogue] getSimilarBooks a échoué :", error);
    return [];
  }
}

/** Requête de secours : les livres qui partagent le plus de genres. */
async function similarByGenres(
  supabase: SupabaseClient,
  bookId: string,
  limit: number,
): Promise<RecommendedBook[]> {
  const ownGenres = (await fetchGenreMap(supabase, [bookId])).get(bookId) ?? [];
  if (!ownGenres.length) return [];

  const { data, error } = await supabase
    .from("book_genres")
    .select("book_id, genre_slug")
    .in("genre_slug", ownGenres)
    .limit(600);
  if (error || !data) return [];

  const shared = new Map<string, string[]>();
  for (const row of data as unknown[]) {
    const record = asRecord(row);
    const id = text(record?.book_id);
    const slug = text(record?.genre_slug);
    if (!id || !slug || id === bookId) continue;
    const list = shared.get(id) ?? [];
    list.push(slug);
    shared.set(id, list);
  }

  const ranked = [...shared.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit);
  const books = await fetchBooksByIds(
    supabase,
    ranked.map(([id]) => id),
  );

  const out: RecommendedBook[] = [];
  for (const [id, slugs] of ranked) {
    const book = books.get(id);
    if (!book) continue;
    out.push({ book, score: slugs.length, reason: buildSimilarReason("genre", slugs[0]) });
  }
  return out;
}

/** Les mieux notés du catalogue : repli universel des recommandations. */
async function topRated(
  supabase: SupabaseClient,
  limit: number,
  exclude: Set<string>,
): Promise<RecommendedBook[]> {
  try {
    const { data } = await supabase
      .from("book_stats")
      .select("book_id, average_rating, ratings_count")
      .order("average_rating", { ascending: false })
      .limit(limit + exclude.size + 10);

    const ids: string[] = [];
    for (const row of (data ?? []) as unknown[]) {
      const id = text(asRecord(row)?.book_id);
      if (id && !exclude.has(id)) ids.push(id);
      if (ids.length >= limit) break;
    }

    if (ids.length) {
      const books = await fetchBooksByIds(supabase, ids);
      const out: RecommendedBook[] = [];
      for (const id of ids) {
        const book = books.get(id);
        if (book) out.push({ book, score: 0, reason: buildReason("popular", null) });
      }
      if (out.length) return out;
    }
  } catch {
    // La vue n'existe peut-être pas encore : on prend les derniers ajouts.
  }

  const { data } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit + exclude.size);
  const out: RecommendedBook[] = [];
  for (const row of (data ?? []) as unknown[]) {
    const book = coerceBook(row);
    if (!book || exclude.has(book.id)) continue;
    out.push({ book, score: 0, reason: "Une pépite à découvrir" });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Rail « Pour vous » : fonction SQL `recommend_for_user`, avec repli sur les
 * livres les mieux notés quand l'utilisateur n'a encore rien lu.
 */
export async function getRecommendationsFor(
  userId: string | null | undefined,
  limit = 12,
): Promise<RecommendedBook[]> {
  let supabase: SupabaseClient | null = null;
  try {
    supabase = await createClient();
  } catch {
    supabase = null;
  }

  if (!supabase) {
    return demoTopRated(limit).map((entry) => ({
      book: entry.book,
      score: entry.stats.average_rating ?? 0,
      reason: buildReason("genre", entry.genre_slugs[0] ?? null),
    }));
  }

  try {
    const libraryIds = await fetchLibraryIds(supabase, userId);

    if (userId) {
      const rows = await callRecommendationRpc(
        supabase,
        "recommend_for_user",
        recommendArgs(userId, limit),
      );
      if (rows?.length) {
        const ids = rows.map((row) => row.book_id).slice(0, limit * 2);
        const books = await fetchBooksByIds(supabase, ids);
        const out: RecommendedBook[] = [];
        for (const row of rows) {
          const book = books.get(row.book_id);
          if (!book || libraryIds.has(book.id)) continue;
          out.push({
            book,
            score: row.score,
            reason: buildReason(row.reason_kind, row.reason_label),
          });
          if (out.length >= limit) break;
        }
        if (out.length) return out;
      }
    }

    return await topRated(supabase, limit, libraryIds);
  } catch (error) {
    console.warn("[catalogue] getRecommendationsFor a échoué :", error);
    return [];
  }
}

/* ------------------------------------------------------------ rails ------- */

/** Rail « En cours de lecture » de la page d'accueil. */
export async function listCurrentlyReading(
  userId: string | null | undefined,
  limit = 10,
): Promise<CatalogueBook[]> {
  if (!userId) return [];
  let supabase: SupabaseClient | null = null;
  try {
    supabase = await createClient();
  } catch {
    supabase = null;
  }
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("library_items")
      .select("book_id")
      .eq("user_id", userId)
      .eq("shelf", "reading")
      .order("added_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    const ids: string[] = [];
    for (const row of data as unknown[]) {
      const id = text(asRecord(row)?.book_id);
      if (id) ids.push(id);
    }
    if (!ids.length) return [];

    const books = await fetchBooksByIds(supabase, ids);
    const ordered = ids.map((id) => books.get(id)).filter((b): b is Book => Boolean(b));
    return decorate(supabase, ordered, new Set(ids));
  } catch {
    return [];
  }
}

/** Rail « Les coups de cœur de vos amis » : notes de 5 étoiles des amis. */
export async function listFriendsFavourites(
  userId: string | null | undefined,
  limit = 10,
): Promise<RecommendedBook[]> {
  if (!userId) return [];
  let supabase: SupabaseClient | null = null;
  try {
    supabase = await createClient();
  } catch {
    supabase = null;
  }
  if (!supabase) return [];

  try {
    const { data: links, error } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .limit(300);
    if (error || !links) return [];

    const friendIds = new Set<string>();
    for (const row of links as unknown[]) {
      const record = asRecord(row);
      const requester = text(record?.requester_id);
      const addressee = text(record?.addressee_id);
      if (requester && requester !== userId) friendIds.add(requester);
      if (addressee && addressee !== userId) friendIds.add(addressee);
    }
    if (!friendIds.size) return [];

    const { data: ratings } = await supabase
      .from("ratings")
      .select("book_id, rating, user_id")
      .in("user_id", [...friendIds])
      .gte("rating", 5)
      .order("updated_at", { ascending: false })
      .limit(60);

    const mine = await fetchLibraryIds(supabase, userId);
    const ids: string[] = [];
    for (const row of (ratings ?? []) as unknown[]) {
      const id = text(asRecord(row)?.book_id);
      if (id && !mine.has(id) && !ids.includes(id)) ids.push(id);
      if (ids.length >= limit) break;
    }
    if (!ids.length) return [];

    const books = await fetchBooksByIds(supabase, ids);
    const out: RecommendedBook[] = [];
    for (const id of ids) {
      const book = books.get(id);
      if (book) out.push({ book, score: 5, reason: buildReason("friends", null) });
    }
    return out;
  } catch {
    return [];
  }
}

/** Raccourci pratique : « Populaire en ce moment ». */
export async function listPopular(limit = 10, userId?: string | null) {
  const { items } = await listBooks({ sort: "populaire", limit, userId });
  return items;
}

/** Raccourci pratique : « Les mieux notés du moment ». */
export async function listTopRated(limit = 10, userId?: string | null) {
  const { items } = await listBooks({ sort: "mieux-note", limit, userId });
  return items;
}

/** Utilisé par la page d'accueil en mode démonstration. */
export function demoHighlights(limit = 10): CatalogueBook[] {
  return demoPopular(limit).map(demoToCatalogueBook);
}
