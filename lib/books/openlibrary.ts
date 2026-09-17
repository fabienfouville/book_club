import {
  asRecord,
  normalizeOpenLibraryDoc,
  openLibraryCover,
  openLibraryDescription,
  mapSubjectsToGenres,
  pickIsbn13,
  normalizeLanguage,
  type ExternalBook,
} from "./normalize";

/**
 * Adaptateur Open Library — **aucune clé API**, aucun quota déclaré.
 * Source principale du catalogue : c'est elle qui sert aussi les couvertures.
 */

const SEARCH_URL = "https://openlibrary.org/search.json";
const TIMEOUT_MS = 6000;

/** Champs demandés explicitement : la réponse par défaut est énorme. */
const SEARCH_FIELDS = [
  "key",
  "title",
  "subtitle",
  "author_name",
  "first_publish_year",
  "number_of_pages_median",
  "cover_i",
  "isbn",
  "language",
  "subject",
  "first_sentence",
].join(",");

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      accept: "application/json",
      // Open Library demande un agent identifiable pour ses appels anonymes.
      "user-agent": "Bookclub/1.0 (https://github.com/bookclub)",
    },
    // Les métadonnées bougent peu : une journée de cache suffit largement.
    next: { revalidate: 86_400 },
  });
  if (!response.ok) {
    throw new Error(`Open Library a répondu ${response.status}`);
  }
  return (await response.json()) as unknown;
}

/** Recherche plein texte. Lève en cas d'échec : l'appelant décide du repli. */
export async function searchOpenLibrary(
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<ExternalBook[]> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(
    SEARCH_FIELDS,
  )}&limit=${Math.min(Math.max(limit, 1), 40)}`;

  const payload = asRecord(await getJson(url, signal));
  const docs = payload && Array.isArray(payload.docs) ? payload.docs : [];

  const books: ExternalBook[] = [];
  for (const doc of docs) {
    const book = normalizeOpenLibraryDoc(doc);
    if (book) books.push(book);
  }
  return books;
}

/**
 * Détail d'une œuvre (`OL45883W`) : description longue et sujets complets,
 * absents des résultats de recherche.
 */
export async function getOpenLibraryWork(
  workId: string,
  signal?: AbortSignal,
): Promise<ExternalBook | null> {
  const id = workId.replace(/^\/?works\//, "").trim();
  if (!/^OL[0-9]+[WM]$/i.test(id)) return null;

  const payload = asRecord(await getJson(`https://openlibrary.org/works/${id}.json`, signal));
  if (!payload) return null;

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) return null;

  const subjects = Array.isArray(payload.subjects)
    ? payload.subjects.filter((s): s is string => typeof s === "string")
    : [];
  const covers = Array.isArray(payload.covers)
    ? payload.covers.filter((c): c is number => typeof c === "number" && c > 0)
    : [];

  return {
    source: "openlibrary",
    source_id: id,
    isbn13: null,
    title,
    subtitle: typeof payload.subtitle === "string" ? payload.subtitle : null,
    authors: [],
    cover_url: openLibraryCover(covers[0] ?? null, null),
    description: openLibraryDescription(payload.description),
    published_year: null,
    page_count: null,
    language: null,
    genre_slugs: mapSubjectsToGenres(subjects),
  };
}

/**
 * Détail par ISBN — le chemin le plus court quand on scanne un code-barres.
 * Renvoie `null` si l'ISBN est inconnu.
 */
export async function getOpenLibraryByIsbn(
  isbn: string,
  signal?: AbortSignal,
): Promise<ExternalBook | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  if (clean.length !== 10 && clean.length !== 13) return null;

  const payload = asRecord(await getJson(`https://openlibrary.org/isbn/${clean}.json`, signal));
  if (!payload) return null;

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) return null;

  const isbn13 = pickIsbn13([
    ...(Array.isArray(payload.isbn_13) ? payload.isbn_13.map(String) : []),
    clean,
  ]);
  const covers = Array.isArray(payload.covers)
    ? payload.covers.filter((c): c is number => typeof c === "number" && c > 0)
    : [];
  const languages = Array.isArray(payload.languages)
    ? payload.languages
        .map((l) => asRecord(l)?.key)
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.split("/").pop() ?? "")
    : [];

  return {
    source: "openlibrary",
    source_id: `isbn:${isbn13 ?? clean}`,
    isbn13,
    title,
    subtitle: typeof payload.subtitle === "string" ? payload.subtitle : null,
    authors: [],
    cover_url: openLibraryCover(covers[0] ?? null, isbn13),
    description: openLibraryDescription(payload.description),
    published_year:
      typeof payload.publish_date === "string"
        ? Number.parseInt(payload.publish_date.slice(-4), 10) || null
        : null,
    page_count: typeof payload.number_of_pages === "number" ? payload.number_of_pages : null,
    language: normalizeLanguage(languages[0] ?? null),
    genre_slugs: mapSubjectsToGenres(
      Array.isArray(payload.subjects)
        ? payload.subjects.filter((s): s is string => typeof s === "string")
        : [],
    ),
  };
}
