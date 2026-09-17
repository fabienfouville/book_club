import { asRecord, normalizeGoogleVolume, type ExternalBook } from "./normalize";

/**
 * Adaptateur Google Books — **secours** quand Open Library ne répond pas ou
 * ne trouve rien. Appelé sans clé : le quota anonyme suffit à notre usage.
 */

const VOLUMES_URL = "https://www.googleapis.com/books/v1/volumes";
const TIMEOUT_MS = 6000;

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) {
    throw new Error(`Google Books a répondu ${response.status}`);
  }
  return (await response.json()) as unknown;
}

/** Recherche plein texte. Lève en cas d'échec : l'appelant décide du repli. */
export async function searchGoogleBooks(
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<ExternalBook[]> {
  const url =
    `${VOLUMES_URL}?q=${encodeURIComponent(query)}` +
    `&maxResults=${Math.min(Math.max(limit, 1), 40)}&printType=books&orderBy=relevance`;

  const payload = asRecord(await getJson(url, signal));
  const items = payload && Array.isArray(payload.items) ? payload.items : [];

  const books: ExternalBook[] = [];
  for (const item of items) {
    const book = normalizeGoogleVolume(item);
    if (book) books.push(book);
  }
  return books;
}

/** Détail d'un volume Google Books. */
export async function getGoogleVolume(
  volumeId: string,
  signal?: AbortSignal,
): Promise<ExternalBook | null> {
  const id = volumeId.trim();
  if (!id) return null;
  const payload = await getJson(`${VOLUMES_URL}/${encodeURIComponent(id)}`, signal);
  return normalizeGoogleVolume(payload);
}

/** Recherche par ISBN : `q=isbn:9782266320481`. */
export async function getGoogleByIsbn(
  isbn: string,
  signal?: AbortSignal,
): Promise<ExternalBook | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  if (!clean) return null;
  const results = await searchGoogleBooks(`isbn:${clean}`, 1, signal);
  return results[0] ?? null;
}
