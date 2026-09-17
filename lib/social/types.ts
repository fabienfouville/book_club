import type {
  Community,
  CommunityRole,
  Friendship,
  LoanRequest,
  Recommendation,
} from "@/types/database";

/** Résultat uniforme des Server Actions du lot social. */
export type ActionResult<T extends object = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/** Profil réduit : ce dont l'interface sociale a besoin partout. */
export interface ProfileLite {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Livre réduit, compatible avec `BookCardBook`. */
export interface BookLite {
  id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  published_year: number | null;
}

/** État de la relation entre l'utilisateur courant et un autre membre. */
export type FriendState =
  | "self"
  | "none"
  | "sent"
  | "received"
  | "friends"
  | "blocked";

export interface FriendshipWithProfile {
  friendship: Friendship;
  /** L'autre personne de la relation, vue depuis l'utilisateur courant. */
  profile: ProfileLite;
}

export interface FriendshipBuckets {
  friends: FriendshipWithProfile[];
  received: FriendshipWithProfile[];
  sent: FriendshipWithProfile[];
}

export interface OwnerOffer {
  profile: ProfileLite;
  /** `true` si un exemplaire de ce propriétaire est déjà promis ou prêté. */
  unavailable: boolean;
  /** Par quel lien cette personne est visible : amitié ou communauté. */
  via: "ami" | "communaute";
}

export interface LoanRequestView {
  loan: LoanRequest;
  book: BookLite | null;
  owner: ProfileLite | null;
  borrower: ProfileLite | null;
}

export interface RecommendationView {
  recommendation: Recommendation;
  book: BookLite | null;
  from: ProfileLite | null;
  to: ProfileLite | null;
}

export interface CommunityMemberView {
  profile: ProfileLite;
  role: CommunityRole;
  joined_at: string;
}

export interface CommunityWithRole {
  community: Community;
  role: CommunityRole;
  members_count: number;
}

export interface SharedShelfEntry {
  book: BookLite;
  owner: ProfileLite;
  is_lendable: boolean;
  genres: string[];
}

export type ActivityKind = "rating" | "review" | "added";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  at: string;
  profile: ProfileLite;
  book: BookLite | null;
  rating?: number;
  excerpt?: string;
  shelf?: string;
}
