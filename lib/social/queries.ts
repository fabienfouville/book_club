import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Community,
  CommunityMember,
  Friendship,
  LibraryItem,
  LoanRequest,
  Recommendation,
} from "@/types/database";
import type {
  ActivityEntry,
  BookLite,
  CommunityMemberView,
  CommunityWithRole,
  FriendState,
  FriendshipBuckets,
  LoanRequestView,
  OwnerOffer,
  ProfileLite,
  RecommendationView,
  SharedShelfEntry,
} from "./types";

export const PROFILE_FIELDS = "id, username, display_name, avatar_url";
export const BOOK_FIELDS = "id, title, authors, cover_url, published_year";

/** Statuts d'emprunt qui immobilisent un exemplaire. */
export const BLOCKING_LOAN_STATUSES = ["accepted", "borrowed"] as const;

/** Nom à afficher : le nom choisi, sinon le pseudo. */
export function personName(profile: ProfileLite | null | undefined) {
  if (!profile) return "Membre inconnu";
  return profile.display_name?.trim() || profile.username;
}

function unique(ids: Array<string | null | undefined>) {
  return [...new Set(ids.filter((v): v is string => Boolean(v)))];
}

/* ------------------------------------------------------------- hydratation */

export async function fetchProfiles(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>,
): Promise<Map<string, ProfileLite>> {
  const list = unique(ids);
  if (list.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .in("id", list);
  const rows = (data ?? []) as ProfileLite[];
  return new Map(rows.map((p) => [p.id, p]));
}

export async function fetchBooks(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>,
): Promise<Map<string, BookLite>> {
  const list = unique(ids);
  if (list.length === 0) return new Map();
  const { data } = await supabase.from("books").select(BOOK_FIELDS).in("id", list);
  const rows = (data ?? []) as BookLite[];
  return new Map(rows.map((b) => [b.id, b]));
}

/** Genres par livre, joints côté applicatif pour rester indépendant des FK. */
export async function fetchGenresByBook(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string[]>> {
  const list = unique(ids);
  if (list.length === 0) return new Map();
  const { data } = await supabase
    .from("book_genres")
    .select("book_id, genre_slug")
    .in("book_id", list);
  const rows = (data ?? []) as Array<{ book_id: string; genre_slug: string }>;
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const current = map.get(row.book_id);
    if (current) current.push(row.genre_slug);
    else map.set(row.book_id, [row.genre_slug]);
  }
  return map;
}

/* ------------------------------------------------------------------ profils */

export async function getProfileByUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<ProfileLite | null> {
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("username", username)
    .maybeSingle();
  return (data as ProfileLite | null) ?? null;
}

/** Recherche de membres par pseudo (et par nom affiché, plus tolérant). */
export async function searchProfilesByUsername(
  supabase: SupabaseClient,
  query: string,
  excludeId?: string,
): Promise<ProfileLite[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const safe = q.replace(/[%,()]/g, " ");
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .limit(20);
  const rows = (data ?? []) as ProfileLite[];
  return excludeId ? rows.filter((p) => p.id !== excludeId) : rows;
}

/* --------------------------------------------------------------- amitiés */

/** Toutes les relations impliquant l'utilisateur, dans les deux sens. */
export async function fetchFriendshipRows(
  supabase: SupabaseClient,
  userId: string,
): Promise<Friendship[]> {
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as Friendship[];
}

export async function getFriendshipBuckets(
  supabase: SupabaseClient,
  userId: string,
): Promise<FriendshipBuckets> {
  const rows = await fetchFriendshipRows(supabase, userId);
  const otherIds = rows.map((r) =>
    r.requester_id === userId ? r.addressee_id : r.requester_id,
  );
  const profiles = await fetchProfiles(supabase, otherIds);

  const buckets: FriendshipBuckets = { friends: [], received: [], sent: [] };
  for (const friendship of rows) {
    const otherId =
      friendship.requester_id === userId
        ? friendship.addressee_id
        : friendship.requester_id;
    const profile = profiles.get(otherId);
    if (!profile) continue;
    const entry = { friendship, profile };
    if (friendship.status === "accepted") buckets.friends.push(entry);
    else if (friendship.status === "pending") {
      if (friendship.addressee_id === userId) buckets.received.push(entry);
      else buckets.sent.push(entry);
    }
  }
  buckets.friends.sort((a, b) =>
    personName(a.profile).localeCompare(personName(b.profile), "fr"),
  );
  return buckets;
}

/** Identifiants des amis acceptés. */
export async function getFriendIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const rows = await fetchFriendshipRows(supabase, userId);
  return rows
    .filter((r) => r.status === "accepted")
    .map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
}

export async function getFriendProfiles(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileLite[]> {
  const ids = await getFriendIds(supabase, userId);
  const map = await fetchProfiles(supabase, ids);
  return [...map.values()].sort((a, b) =>
    personName(a).localeCompare(personName(b), "fr"),
  );
}

/** État de la relation entre deux membres, du point de vue de `userId`. */
export async function getFriendState(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<{ state: FriendState; friendship: Friendship | null }> {
  if (userId === otherId) return { state: "self", friendship: null };
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),` +
        `and(requester_id.eq.${otherId},addressee_id.eq.${userId})`,
    )
    .limit(1)
    .maybeSingle();

  const friendship = (data as Friendship | null) ?? null;
  if (!friendship) return { state: "none", friendship: null };
  if (friendship.status === "accepted") return { state: "friends", friendship };
  if (friendship.status === "blocked") return { state: "blocked", friendship };
  return {
    state: friendship.addressee_id === userId ? "received" : "sent",
    friendship,
  };
}

/* ------------------------------------------------------------ communautés */

export async function getMyCommunityIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId);
  const rows = (data ?? []) as Array<{ community_id: string }>;
  return unique(rows.map((r) => r.community_id));
}

export async function getMyCommunities(
  supabase: SupabaseClient,
  userId: string,
): Promise<CommunityWithRole[]> {
  const { data: memberships } = await supabase
    .from("community_members")
    .select("community_id, role")
    .eq("user_id", userId);
  const rows = (memberships ?? []) as Array<{
    community_id: string;
    role: CommunityWithRole["role"];
  }>;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.community_id);
  const { data: communities } = await supabase
    .from("communities")
    .select("*")
    .in("id", ids);
  const { data: allMembers } = await supabase
    .from("community_members")
    .select("community_id")
    .in("community_id", ids);

  const counts = new Map<string, number>();
  for (const m of (allMembers ?? []) as Array<{ community_id: string }>) {
    counts.set(m.community_id, (counts.get(m.community_id) ?? 0) + 1);
  }
  const roleById = new Map(rows.map((r) => [r.community_id, r.role]));

  return ((communities ?? []) as Community[])
    .map((community) => ({
      community,
      role: roleById.get(community.id) ?? "member",
      members_count: counts.get(community.id) ?? 1,
    }))
    .sort((a, b) => a.community.name.localeCompare(b.community.name, "fr"));
}

export async function getCommunityBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Community | null> {
  const { data } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Community | null) ?? null;
}

export async function getCommunityByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<Community | null> {
  const { data } = await supabase
    .from("communities")
    .select("*")
    .eq("invite_code", code.trim().toUpperCase())
    .maybeSingle();
  return (data as Community | null) ?? null;
}

export async function getCommunityMembers(
  supabase: SupabaseClient,
  communityId: string,
): Promise<CommunityMemberView[]> {
  const { data } = await supabase
    .from("community_members")
    .select("*")
    .eq("community_id", communityId)
    .order("joined_at", { ascending: true });
  const rows = (data ?? []) as CommunityMember[];
  const profiles = await fetchProfiles(supabase, rows.map((r) => r.user_id));
  return rows
    .map((row) => {
      const profile = profiles.get(row.user_id);
      return profile
        ? { profile, role: row.role, joined_at: row.joined_at }
        : null;
    })
    .filter((v): v is CommunityMemberView => v !== null);
}

/** Membres des communautés de l'utilisateur (hors lui-même). */
export async function getCommunityPeerIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const communityIds = await getMyCommunityIds(supabase, userId);
  if (communityIds.length === 0) return [];
  const { data } = await supabase
    .from("community_members")
    .select("user_id")
    .in("community_id", communityIds);
  const rows = (data ?? []) as Array<{ user_id: string }>;
  return unique(rows.map((r) => r.user_id)).filter((id) => id !== userId);
}

/** Cercle social : amis + membres de mes communautés. */
export async function getSocialCircle(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ friendIds: string[]; peerIds: string[]; allIds: string[] }> {
  const [friendIds, peerIds] = await Promise.all([
    getFriendIds(supabase, userId),
    getCommunityPeerIds(supabase, userId),
  ]);
  return { friendIds, peerIds, allIds: unique([...friendIds, ...peerIds]) };
}

/* ------------------------------------------------------- étagères partagées */

/**
 * Livres possédés par un groupe de membres, avec leur propriétaire et leurs
 * genres. Sert à l'étagère partagée d'une communauté.
 */
export async function getSharedShelf(
  supabase: SupabaseClient,
  ownerIds: string[],
  options: { onlyLendable?: boolean; limit?: number } = {},
): Promise<SharedShelfEntry[]> {
  if (ownerIds.length === 0) return [];
  let request = supabase
    .from("library_items")
    .select("user_id, book_id, is_owned, is_lendable, added_at")
    .in("user_id", ownerIds)
    .eq("is_owned", true)
    .order("added_at", { ascending: false })
    .limit(options.limit ?? 200);
  if (options.onlyLendable) request = request.eq("is_lendable", true);

  const { data } = await request;
  const rows = (data ?? []) as Array<
    Pick<LibraryItem, "user_id" | "book_id" | "is_owned" | "is_lendable">
  >;
  if (rows.length === 0) return [];

  const [books, profiles, genres] = await Promise.all([
    fetchBooks(supabase, rows.map((r) => r.book_id)),
    fetchProfiles(supabase, rows.map((r) => r.user_id)),
    fetchGenresByBook(supabase, rows.map((r) => r.book_id)),
  ]);

  return rows
    .map((row) => {
      const book = books.get(row.book_id);
      const owner = profiles.get(row.user_id);
      if (!book || !owner) return null;
      return {
        book,
        owner,
        is_lendable: row.is_lendable,
        genres: genres.get(row.book_id) ?? [],
      };
    })
    .filter((v): v is SharedShelfEntry => v !== null);
}

/* ------------------------------------------------------------------ emprunts */

/** Exemplaires immobilisés : clé `book_id:owner_id`. */
export async function getBlockedCopies(
  supabase: SupabaseClient,
  bookIds: string[],
): Promise<Set<string>> {
  const list = unique(bookIds);
  if (list.length === 0) return new Set();
  const { data } = await supabase
    .from("loan_requests")
    .select("book_id, owner_id, status")
    .in("book_id", list)
    .in("status", [...BLOCKING_LOAN_STATUSES]);
  const rows = (data ?? []) as Array<{ book_id: string; owner_id: string }>;
  return new Set(rows.map((r) => `${r.book_id}:${r.owner_id}`));
}

/**
 * Personnes de mon cercle qui possèdent ce livre et acceptent de le prêter.
 * Les amis sont présentés avant les simples membres de communauté.
 */
export async function getLendableOwners(
  supabase: SupabaseClient,
  bookId: string,
  circle: { friendIds: string[]; peerIds: string[]; allIds: string[] },
): Promise<OwnerOffer[]> {
  if (circle.allIds.length === 0) return [];
  const { data } = await supabase
    .from("library_items")
    .select("user_id, is_owned, is_lendable")
    .eq("book_id", bookId)
    .eq("is_owned", true)
    .eq("is_lendable", true)
    .in("user_id", circle.allIds);
  const rows = (data ?? []) as Array<{ user_id: string }>;
  if (rows.length === 0) return [];

  const [profiles, blocked] = await Promise.all([
    fetchProfiles(supabase, rows.map((r) => r.user_id)),
    getBlockedCopies(supabase, [bookId]),
  ]);
  const friends = new Set(circle.friendIds);

  return rows
    .map((row) => {
      const profile = profiles.get(row.user_id);
      if (!profile) return null;
      return {
        profile,
        unavailable: blocked.has(`${bookId}:${row.user_id}`),
        via: friends.has(row.user_id) ? ("ami" as const) : ("communaute" as const),
      };
    })
    .filter((v): v is OwnerOffer => v !== null)
    .sort((a, b) => (a.via === b.via ? 0 : a.via === "ami" ? -1 : 1));
}

export async function getLoanRequests(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ received: LoanRequestView[]; sent: LoanRequestView[] }> {
  const { data } = await supabase
    .from("loan_requests")
    .select("*")
    .or(`owner_id.eq.${userId},borrower_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as LoanRequest[];

  const [books, profiles] = await Promise.all([
    fetchBooks(supabase, rows.map((r) => r.book_id)),
    fetchProfiles(supabase, rows.flatMap((r) => [r.owner_id, r.borrower_id])),
  ]);

  const views = rows.map((loan) => ({
    loan,
    book: books.get(loan.book_id) ?? null,
    owner: profiles.get(loan.owner_id) ?? null,
    borrower: profiles.get(loan.borrower_id) ?? null,
  }));

  return {
    received: views.filter((v) => v.loan.owner_id === userId),
    sent: views.filter((v) => v.loan.borrower_id === userId),
  };
}

/* ----------------------------------------------------------- recommandations */

export async function getRecommendations(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ received: RecommendationView[]; sent: RecommendationView[] }> {
  const { data } = await supabase
    .from("recommendations")
    .select("*")
    .or(`to_user.eq.${userId},from_user.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(120);
  const rows = (data ?? []) as Recommendation[];

  const [books, profiles] = await Promise.all([
    fetchBooks(supabase, rows.map((r) => r.book_id)),
    fetchProfiles(supabase, rows.flatMap((r) => [r.from_user, r.to_user])),
  ]);

  const views = rows.map((recommendation) => ({
    recommendation,
    book: books.get(recommendation.book_id) ?? null,
    from: profiles.get(recommendation.from_user) ?? null,
    to: profiles.get(recommendation.to_user) ?? null,
  }));

  return {
    received: views.filter(
      (v) =>
        v.recommendation.to_user === userId &&
        v.recommendation.status !== "dismissed",
    ),
    sent: views.filter((v) => v.recommendation.from_user === userId),
  };
}

/* --------------------------------------------------------------- activité */

/** Fil d'activité d'un groupe : dernières notes, avis et ajouts. */
export async function getGroupActivity(
  supabase: SupabaseClient,
  memberIds: string[],
  limit = 15,
): Promise<ActivityEntry[]> {
  if (memberIds.length === 0) return [];

  const [ratingsRes, reviewsRes, itemsRes] = await Promise.all([
    supabase
      .from("ratings")
      .select("user_id, book_id, rating, updated_at")
      .in("user_id", memberIds)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("reviews")
      .select("id, user_id, book_id, body, created_at")
      .in("user_id", memberIds)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("library_items")
      .select("user_id, book_id, shelf, added_at")
      .in("user_id", memberIds)
      .order("added_at", { ascending: false })
      .limit(limit),
  ]);

  const ratings = (ratingsRes.data ?? []) as Array<{
    user_id: string;
    book_id: string;
    rating: number;
    updated_at: string;
  }>;
  const reviews = (reviewsRes.data ?? []) as Array<{
    id: string;
    user_id: string;
    book_id: string;
    body: string;
    created_at: string;
  }>;
  const items = (itemsRes.data ?? []) as Array<{
    user_id: string;
    book_id: string;
    shelf: string;
    added_at: string;
  }>;

  const [books, profiles] = await Promise.all([
    fetchBooks(supabase, [
      ...ratings.map((r) => r.book_id),
      ...reviews.map((r) => r.book_id),
      ...items.map((r) => r.book_id),
    ]),
    fetchProfiles(supabase, [
      ...ratings.map((r) => r.user_id),
      ...reviews.map((r) => r.user_id),
      ...items.map((r) => r.user_id),
    ]),
  ]);

  const entries: ActivityEntry[] = [];
  for (const r of ratings) {
    const profile = profiles.get(r.user_id);
    if (!profile) continue;
    entries.push({
      id: `rating-${r.user_id}-${r.book_id}`,
      kind: "rating",
      at: r.updated_at,
      profile,
      book: books.get(r.book_id) ?? null,
      rating: r.rating,
    });
  }
  for (const r of reviews) {
    const profile = profiles.get(r.user_id);
    if (!profile) continue;
    entries.push({
      id: `review-${r.id}`,
      kind: "review",
      at: r.created_at,
      profile,
      book: books.get(r.book_id) ?? null,
      excerpt: r.body.slice(0, 160),
    });
  }
  for (const r of items) {
    const profile = profiles.get(r.user_id);
    if (!profile) continue;
    entries.push({
      id: `item-${r.user_id}-${r.book_id}`,
      kind: "added",
      at: r.added_at,
      profile,
      book: books.get(r.book_id) ?? null,
      shelf: r.shelf,
    });
  }

  return entries
    .filter((e) => e.book !== null)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);
}
