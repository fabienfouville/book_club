import type { Book, LibraryItem, Shelf } from "@/types/database";

/** Forme de retour commune à toutes les Server Actions du lot bibliothèque. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Filtre de possession piloté par l'URL. */
export type Ownership = "tous" | "possede" | "non-possede" | "pretes";

export const OWNERSHIP_LABELS: Record<Ownership, string> = {
  tous: "Tous",
  possede: "Que je possède",
  "non-possede": "Que je ne possède pas",
  pretes: "Que je prête",
};

export const OWNERSHIP_VALUES = Object.keys(OWNERSHIP_LABELS) as Ownership[];

/** Une ligne de bibliothèque, enrichie du livre, de ses genres et de ma note. */
export interface LibraryEntry {
  item: LibraryItem;
  book: Book;
  genres: string[];
  my_rating: number | null;
}

/** État de l'utilisateur courant vis-à-vis d'un livre, pour `BookActions`. */
export interface BookUserState {
  /** Supabase n'est pas configuré : contrôles désactivés. */
  demo: boolean;
  /** Personne n'est connecté : on invite à se connecter. */
  anonymous: boolean;
  shelf: Shelf | null;
  is_owned: boolean;
  is_lendable: boolean;
  rating: number | null;
  review: { id: string; body: string; has_spoiler: boolean } | null;
}

/** Un avis prêt à afficher dans le fil. */
export interface ReviewWithAuthor {
  id: string;
  book_id: string;
  body: string;
  has_spoiler: boolean;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  /** Note donnée par l'auteur de l'avis à ce livre. */
  author_rating: number | null;
  likes_count: number;
  liked_by_me: boolean;
  /** Vrai si l'avis appartient à l'utilisateur connecté. */
  mine: boolean;
}

/** Répartition des notes d'un livre, de 1 à 5. */
export interface RatingDistribution {
  /** Index 0 → 1 étoile, index 4 → 5 étoiles. */
  counts: [number, number, number, number, number];
  total: number;
  average: number | null;
}
