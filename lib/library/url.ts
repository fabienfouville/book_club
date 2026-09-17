import { SHELF_LABELS, type Shelf } from "@/types/database";
import { OWNERSHIP_VALUES, type Ownership } from "./types";
import type { LibraryFilters } from "./queries";

/**
 * L'état des filtres vit dans l'URL : la vue est partageable et le bouton
 * « retour » du navigateur défait bien le dernier filtre posé.
 */

export const LIBRARY_PATH = "/bibliotheque";

const SHELVES = Object.keys(SHELF_LABELS) as Shelf[];

type RawParams = Record<string, string | string[] | undefined>;

function premier(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Lit les `searchParams` sans jamais faire confiance à leur contenu. */
export function parseLibraryParams(params: RawParams): LibraryFilters {
  const etagere = premier(params.etagere);
  const possession = premier(params.possession);
  const genre = premier(params.genre).slice(0, 48);
  const q = premier(params.q).slice(0, 80);

  return {
    shelf: (SHELVES as string[]).includes(etagere) ? (etagere as Shelf) : null,
    genre: genre || null,
    ownership: (OWNERSHIP_VALUES as string[]).includes(possession)
      ? (possession as Ownership)
      : "tous",
    q,
  };
}

/** Construit l'URL de la bibliothèque avec un filtre modifié. */
export function libraryHref(
  filters: LibraryFilters,
  patch: Partial<LibraryFilters> = {},
): string {
  const next = { ...filters, ...patch };
  const search = new URLSearchParams();
  if (next.shelf) search.set("etagere", next.shelf);
  if (next.genre) search.set("genre", next.genre);
  if (next.ownership && next.ownership !== "tous") {
    search.set("possession", next.ownership);
  }
  if (next.q) search.set("q", next.q);
  const query = search.toString();
  return query ? `${LIBRARY_PATH}?${query}` : LIBRARY_PATH;
}

/** Vrai dès qu'un filtre est posé — sert à proposer « Tout effacer ». */
export function hasActiveFilters(filters: LibraryFilters): boolean {
  return Boolean(
    filters.shelf || filters.genre || filters.q || filters.ownership !== "tous",
  );
}
