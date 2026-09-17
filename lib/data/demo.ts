import type { Book, BookStats } from "@/types/database";
import catalogue from "./catalogue.json";

/**
 * Mode démonstration : quand Supabase n'est pas configuré, le site tourne sur
 * ce catalogue local en lecture seule. Les statistiques (notes, avis) sont
 * **fabriquées de façon déterministe** à partir de l'identifiant du livre :
 * elles ne changent donc pas d'un rendu à l'autre, et ne provoquent aucune
 * différence entre le serveur et le navigateur.
 */

export interface DemoEntry {
  book: Book;
  genre_slugs: string[];
  stats: BookStats;
}

interface RawBook {
  id: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  published_year: number | null;
  page_count: number | null;
  genres: string[];
  description: string | null;
  cover_url: string | null;
}

/** Hachage FNV-1a : stable, sans dépendance, suffisant pour du décoratif. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
}

/** Date de création fictive : le premier livre du fichier est le plus ancien. */
function fakeCreatedAt(index: number, total: number): string {
  const base = Date.UTC(2025, 0, 1);
  const day = 86_400_000;
  return new Date(base + (total - index) * day * 3).toISOString();
}

function fakeStats(id: string): BookStats {
  const seed = hash(id);
  const ratings = 3 + (seed % 160);
  const average = 3.2 + ((seed >> 5) % 17) / 10;
  return {
    book_id: id,
    average_rating: Math.round(Math.min(average, 4.9) * 10) / 10,
    ratings_count: ratings,
    reviews_count: Math.max(1, Math.round(ratings * 0.32)),
    owners_count: Math.max(1, Math.round(ratings * 0.55)),
    readers_count: Math.max(1, Math.round(ratings * 0.9)),
  };
}

const RAW = catalogue as RawBook[];

export const DEMO_BOOKS: DemoEntry[] = RAW.map((raw, index) => ({
  book: {
    id: raw.id,
    source: "seed",
    source_id: raw.isbn13,
    isbn13: raw.isbn13,
    title: raw.title,
    subtitle: null,
    authors: raw.authors,
    cover_url: raw.cover_url,
    description: raw.description,
    published_year: raw.published_year,
    page_count: raw.page_count,
    language: "fr",
    added_by: null,
    created_at: fakeCreatedAt(index, RAW.length),
  },
  genre_slugs: raw.genres,
  stats: fakeStats(raw.id),
}));

export const DEMO_BY_ID = new Map(DEMO_BOOKS.map((entry) => [entry.book.id, entry]));

export function getDemoBook(id: string): DemoEntry | null {
  return DEMO_BY_ID.get(id) ?? null;
}

/** Répartition fictive des étoiles, cohérente avec la moyenne affichée. */
export function demoDistribution(id: string): number[] {
  const { stats } = DEMO_BY_ID.get(id) ?? { stats: fakeStats(id) };
  const average = stats.average_rating ?? 4;
  const total = stats.ratings_count;
  // Poids en cloche centrée sur la moyenne.
  const weights = [1, 2, 3, 4, 5].map((star) => 1 / (1 + Math.abs(star - average) ** 2.2));
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.round((w / sum) * total));
  // On rattrape l'arrondi sur l'étoile majoritaire.
  const drift = total - counts.reduce((a, b) => a + b, 0);
  const top = counts.indexOf(Math.max(...counts));
  counts[top] = Math.max(0, counts[top] + drift);
  return counts;
}

/** Similarité locale : nombre de genres partagés, puis note moyenne. */
export function demoSimilar(id: string, limit = 12): Array<{ entry: DemoEntry; shared: string[] }> {
  const source = DEMO_BY_ID.get(id);
  if (!source) return [];
  const mine = new Set(source.genre_slugs);

  return DEMO_BOOKS.filter((entry) => entry.book.id !== id)
    .map((entry) => ({
      entry,
      shared: entry.genre_slugs.filter((slug) => mine.has(slug)),
      sameAuthor: entry.book.authors.some((a) => source.book.authors.includes(a)),
    }))
    .filter((row) => row.shared.length > 0 || row.sameAuthor)
    .sort((a, b) => {
      const score =
        (b.shared.length + (b.sameAuthor ? 2 : 0)) - (a.shared.length + (a.sameAuthor ? 2 : 0));
      if (score !== 0) return score;
      return (b.entry.stats.average_rating ?? 0) - (a.entry.stats.average_rating ?? 0);
    })
    .slice(0, limit)
    .map(({ entry, shared }) => ({ entry, shared }));
}

/** Les mieux notés du catalogue de démonstration. */
export function demoTopRated(limit = 12): DemoEntry[] {
  return [...DEMO_BOOKS]
    .sort((a, b) => (b.stats.average_rating ?? 0) - (a.stats.average_rating ?? 0))
    .slice(0, limit);
}

/** Les plus commentés : sert de « Populaire en ce moment ». */
export function demoPopular(limit = 12): DemoEntry[] {
  return [...DEMO_BOOKS]
    .sort((a, b) => b.stats.ratings_count - a.stats.ratings_count)
    .slice(0, limit);
}
