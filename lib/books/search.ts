import { searchOpenLibrary } from "./openlibrary";
import { searchGoogleBooks } from "./googlebooks";
import { dedupeExternalBooks, type ExternalBook } from "./normalize";

const TIMEOUT_MS = 6000;

export interface ExternalSearchResult {
  items: ExternalBook[];
  /** Source réellement utilisée : utile pour l'afficher à l'utilisateur. */
  source: "openlibrary" | "googlebooks" | "aucune";
}

/** Une source qui met plus de 6 s est considérée indisponible. */
async function trySource(
  name: string,
  run: (signal: AbortSignal) => Promise<ExternalBook[]>,
): Promise<ExternalBook[]> {
  try {
    return await run(AbortSignal.timeout(TIMEOUT_MS));
  } catch (error) {
    // Une recherche externe ne doit jamais casser une page : on journalise.
    console.warn(`[books] ${name} indisponible :`, error);
    return [];
  }
}

/**
 * Recherche externe : Open Library d'abord, Google Books en secours si la
 * première échoue ou ne renvoie rien. Ne lève jamais.
 */
export async function searchExternalBooksDetailed(
  query: string,
  limit = 20,
): Promise<ExternalSearchResult> {
  const cleaned = query.trim().replace(/\s+/g, " ");
  if (cleaned.length < 2) return { items: [], source: "aucune" };

  const openLibrary = await trySource("Open Library", (signal) =>
    searchOpenLibrary(cleaned, limit, signal),
  );
  if (openLibrary.length) {
    return { items: dedupeExternalBooks(openLibrary).slice(0, limit), source: "openlibrary" };
  }

  const google = await trySource("Google Books", (signal) =>
    searchGoogleBooks(cleaned, limit, signal),
  );
  if (google.length) {
    return { items: dedupeExternalBooks(google).slice(0, limit), source: "googlebooks" };
  }

  return { items: [], source: "aucune" };
}

/** Forme courte : la liste seule, vide si aucune source n'a répondu. */
export async function searchExternalBooks(
  query: string,
  limit = 20,
): Promise<ExternalBook[]> {
  const { items } = await searchExternalBooksDetailed(query, limit);
  return items;
}
