/**
 * Contrat de données de Bookclub.
 *
 * Ce fichier fait foi : les migrations SQL de `supabase/migrations` doivent
 * correspondre exactement aux noms de tables, de colonnes et aux valeurs
 * d'énumération décrits ici.
 */

export type Shelf = "wishlist" | "reading" | "read" | "abandoned";
export type FriendshipStatus = "pending" | "accepted" | "blocked";
export type LoanStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "borrowed"
  | "returned"
  | "cancelled";
export type RecommendationStatus = "sent" | "seen" | "saved" | "dismissed";
export type CommunityRole = "owner" | "member";
export type BookSource = "openlibrary" | "googlebooks" | "manual" | "seed";

export type NotificationKind =
  | "friend_request"
  | "friend_accepted"
  | "recommendation"
  | "loan_requested"
  | "loan_accepted"
  | "loan_declined"
  | "loan_returned"
  | "community_joined";

export const SHELF_LABELS: Record<Shelf, string> = {
  wishlist: "Envie de lire",
  reading: "En cours",
  read: "Lu",
  abandoned: "Abandonné",
};

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  declined: "Refusée",
  borrowed: "Prêté",
  returned: "Rendu",
  cancelled: "Annulée",
};

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_genres: string[];
  is_public: boolean;
  onboarded_at: string | null;
  created_at: string;
}

export interface Book {
  id: string;
  source: BookSource;
  source_id: string | null;
  isbn13: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  cover_url: string | null;
  description: string | null;
  published_year: number | null;
  page_count: number | null;
  language: string | null;
  added_by: string | null;
  created_at: string;
}

export interface Genre {
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
}

export interface BookGenre {
  book_id: string;
  genre_slug: string;
}

export interface LibraryItem {
  user_id: string;
  book_id: string;
  shelf: Shelf;
  is_owned: boolean;
  is_lendable: boolean;
  notes: string | null;
  added_at: string;
  finished_at: string | null;
}

export interface Rating {
  user_id: string;
  book_id: string;
  rating: number; // 1..5
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  book_id: string;
  body: string;
  has_spoiler: boolean;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  owner_id: string;
  invite_code: string;
  is_open: boolean;
  created_at: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: CommunityRole;
  joined_at: string;
}

export interface Recommendation {
  id: string;
  from_user: string;
  to_user: string;
  book_id: string;
  message: string | null;
  status: RecommendationStatus;
  created_at: string;
}

export interface LoanRequest {
  id: string;
  book_id: string;
  owner_id: string;
  borrower_id: string;
  status: LoanStatus;
  message: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ vues --- */

/** Vue `book_stats` : agrégats publics d'un livre. */
export interface BookStats {
  book_id: string;
  average_rating: number | null;
  ratings_count: number;
  reviews_count: number;
  owners_count: number;
  readers_count: number;
}

/** Livre enrichi tel que consommé par l'interface. */
export interface BookWithContext extends Book {
  genres: Genre[];
  stats: BookStats;
  /** Entrée de bibliothèque de l'utilisateur courant, si elle existe. */
  library_item: LibraryItem | null;
  /** Note de l'utilisateur courant, si elle existe. */
  my_rating: number | null;
}

/** Résultat du moteur de recommandation. */
export interface RecommendedBook {
  book: Book;
  score: number;
  /** Phrase affichée : « Parce que vous avez aimé Dune ». */
  reason: string;
}

/** Résultat brut de la fonction SQL `recommend_for_user`. */
export interface RecommendationRow {
  book_id: string;
  score: number;
  reason_kind: "genre" | "author" | "co_read" | "friends" | "popular";
  reason_label: string | null;
}
