import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecommendationRow } from "@/types/database";

/**
 * Les fonctions SQL `similar_books()` et `recommend_for_user()` sont livrées
 * par les migrations. Elles peuvent être absentes (base pas encore migrée) ou
 * nommer leur paramètre autrement : on essaie donc plusieurs signatures, et on
 * renvoie `null` si aucune ne répond, ce qui déclenche la requête de secours.
 */
export async function callRecommendationRpc(
  supabase: SupabaseClient,
  fn: "similar_books" | "recommend_for_user",
  variants: Array<Record<string, unknown>>,
): Promise<RecommendationRow[] | null> {
  for (const args of variants) {
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) continue;
      if (!Array.isArray(data)) continue;
      return parseRows(data);
    } catch {
      // Fonction absente ou signature inconnue : on tente la variante suivante.
    }
  }
  console.warn(`[reco] ${fn} indisponible, repli sur la requête de secours.`);
  return null;
}

const KINDS = new Set(["genre", "author", "co_read", "friends", "popular"]);

function parseRows(rows: unknown[]): RecommendationRow[] {
  const out: RecommendationRow[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;
    const bookId = record.book_id;
    if (typeof bookId !== "string") continue;
    const kind = typeof record.reason_kind === "string" ? record.reason_kind : "popular";
    out.push({
      book_id: bookId,
      score: typeof record.score === "number" ? record.score : 0,
      reason_kind: (KINDS.has(kind) ? kind : "popular") as RecommendationRow["reason_kind"],
      reason_label:
        typeof record.reason_label === "string" && record.reason_label.trim()
          ? record.reason_label.trim()
          : null,
    });
  }
  return out;
}

/** Variantes de nommage acceptées pour `similar_books(book_id)`. */
export function similarArgs(bookId: string, limit: number) {
  return [
    { p_book_id: bookId, p_limit: limit },
    { p_book_id: bookId },
    { book_id: bookId, limit_count: limit },
    { book_id: bookId },
  ];
}

/** Variantes de nommage acceptées pour `recommend_for_user(user_id)`. */
export function recommendArgs(userId: string, limit: number) {
  return [
    { p_user_id: userId, p_limit: limit },
    { p_user_id: userId },
    { user_id: userId, limit_count: limit },
    { user_id: userId },
  ];
}
