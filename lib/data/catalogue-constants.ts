/**
 * Constantes de tri et de filtrage du catalogue, extraites dans un fichier à
 * part : `lib/data/catalogue.ts` importe des clients Supabase serveur
 * (`next/headers`), donc tout composant client qui a seulement besoin de ces
 * constantes doit les prendre ici pour ne pas embarquer du code serveur.
 */

export const SORTS = ["populaire", "mieux-note", "recent", "titre"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  populaire: "Les plus populaires",
  "mieux-note": "Les mieux notés",
  recent: "Ajoutés récemment",
  titre: "Ordre alphabétique",
};

export const OWNERSHIPS = ["tous", "dans-ma-biblio", "hors-ma-biblio"] as const;
export type Ownership = (typeof OWNERSHIPS)[number];

export const OWNERSHIP_LABELS: Record<Ownership, string> = {
  tous: "Tous",
  "dans-ma-biblio": "Dans ma bibliothèque",
  "hors-ma-biblio": "Pas dans ma bibliothèque",
};

export function parseSort(value: string | undefined): Sort {
  return SORTS.includes(value as Sort) ? (value as Sort) : "populaire";
}

export function parseOwnership(value: string | undefined): Ownership {
  return OWNERSHIPS.includes(value as Ownership) ? (value as Ownership) : "tous";
}
