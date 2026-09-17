"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SHELF_LABELS, type Shelf } from "@/types/database";
import { REVIEW_MAX, type ActionResult } from "@/lib/library/types";

/**
 * Server Actions de la bibliothèque.
 *
 * Chaque action : vérifie la session, valide ses entrées, écrit, revalide les
 * pages concernées, et renvoie `{ ok }` avec un message en français. Aucune
 * action ne lève : l'interface doit pouvoir revenir en arrière proprement.
 */

const SHELVES = Object.keys(SHELF_LABELS) as Shelf[];

const ERREUR_SESSION = "Connectez-vous pour faire ça.";
const ERREUR_DEMO =
  "Mode démo : connectez Supabase pour enregistrer vos livres.";
const ERREUR_GENERIQUE = "Impossible d'enregistrer, réessayez dans un instant.";
const ERREUR_HORS_BIBLIO = "Ajoutez d'abord ce livre à une étagère.";

function ko(error: string): ActionResult {
  return { ok: false, error };
}

function idValide(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

/** Rafraîchit la fiche livre et les pages de bibliothèque après écriture. */
function revalidateBook(bookId: string) {
  revalidatePath(`/livre/${bookId}`);
  revalidatePath("/bibliotheque");
  revalidatePath("/bibliotheque/statistiques");
}

type Session = { supabase: SupabaseClient; userId: string };

/** Résout la session, ou le message d'erreur à afficher. */
async function requireSession(): Promise<Session | ActionResult> {
  const supabase = await createClient();
  if (!supabase) return ko(ERREUR_DEMO);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return ko(ERREUR_SESSION);
  return { supabase, userId: data.user.id };
}

function estSession(value: Session | ActionResult): value is Session {
  return "supabase" in value;
}

/* --------------------------------------------------------------- étagères */

/** Range un livre sur une étagère (crée la ligne si besoin). */
export async function setShelf(
  bookId: string,
  shelf: Shelf,
): Promise<ActionResult> {
  if (!idValide(bookId)) return ko("Livre introuvable.");
  if (!SHELVES.includes(shelf)) return ko("Étagère inconnue.");

  const session = await requireSession();
  if (!estSession(session)) return session;
  const { supabase, userId } = session;

  // `finished_at` n'a de sens que pour l'étagère « Lu ».
  const finished_at = shelf === "read" ? new Date().toISOString() : null;

  const { error } = await supabase.from("library_items").upsert(
    { user_id: userId, book_id: bookId, shelf, finished_at },
    { onConflict: "user_id,book_id" },
  );
  if (error) return ko(ERREUR_GENERIQUE);

  revalidateBook(bookId);
  return { ok: true };
}

/** Retire complètement le livre de la bibliothèque (note et avis conservés). */
export async function removeFromLibrary(bookId: string): Promise<ActionResult> {
  if (!idValide(bookId)) return ko("Livre introuvable.");

  const session = await requireSession();
  if (!estSession(session)) return session;
  const { supabase, userId } = session;

  const { error } = await supabase
    .from("library_items")
    .delete()
    .eq("user_id", userId)
    .eq("book_id", bookId);
  if (error) return ko("Impossible de retirer ce livre, réessayez.");

  revalidateBook(bookId);
  return { ok: true };
}

/* -------------------------------------------------------------- possession */

/** « Je possède ce livre ». Retirer la possession retire aussi le prêt. */
export async function setOwned(
  bookId: string,
  owned: boolean,
): Promise<ActionResult> {
  if (!idValide(bookId)) return ko("Livre introuvable.");
  if (typeof owned !== "boolean") return ko("Valeur invalide.");

  const session = await requireSession();
  if (!estSession(session)) return session;
  const { supabase, userId } = session;

  const patch = owned
    ? { is_owned: true }
    : { is_owned: false, is_lendable: false };

  const { data, error } = await supabase
    .from("library_items")
    .update(patch)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .select("book_id");
  if (error) return ko(ERREUR_GENERIQUE);
  if (!data || data.length === 0) return ko(ERREUR_HORS_BIBLIO);

  revalidateBook(bookId);
  return { ok: true };
}

/** « Je le prête volontiers » — réservé aux livres possédés. */
export async function setLendable(
  bookId: string,
  lendable: boolean,
): Promise<ActionResult> {
  if (!idValide(bookId)) return ko("Livre introuvable.");
  if (typeof lendable !== "boolean") return ko("Valeur invalide.");

  const session = await requireSession();
  if (!estSession(session)) return session;
  const { supabase, userId } = session;

  if (lendable) {
    const { data } = await supabase
      .from("library_items")
      .select("is_owned")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();
    const item = (data ?? null) as unknown as { is_owned: boolean } | null;
    if (!item) return ko(ERREUR_HORS_BIBLIO);
    if (!item.is_owned) {
      return ko("Indiquez d'abord que vous possédez ce livre.");
    }
  }

  const { data, error } = await supabase
    .from("library_items")
    .update({ is_lendable: lendable })
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .select("book_id");
  if (error) return ko(ERREUR_GENERIQUE);
  if (!data || data.length === 0) return ko(ERREUR_HORS_BIBLIO);

  revalidateBook(bookId);
  return { ok: true };
}

/* ------------------------------------------------------------------- note */

/** Note de 1 à 5. `null` efface la note. */
export async function rateBook(
  bookId: string,
  rating: number | null,
): Promise<ActionResult> {
  if (!idValide(bookId)) return ko("Livre introuvable.");

  const session = await requireSession();
  if (!estSession(session)) return session;
  const { supabase, userId } = session;

  if (rating === null) {
    const { error } = await supabase
      .from("ratings")
      .delete()
      .eq("user_id", userId)
      .eq("book_id", bookId);
    if (error) return ko("Impossible de retirer la note.");
    revalidateBook(bookId);
    return { ok: true };
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return ko("La note va de 1 à 5 étoiles.");
  }

  const { error } = await supabase.from("ratings").upsert(
    {
      user_id: userId,
      book_id: bookId,
      rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,book_id" },
  );
  if (error) return ko("Impossible d'enregistrer la note.");

  revalidateBook(bookId);
  return { ok: true };
}

/* ------------------------------------------------------------------- avis */

/** Crée ou met à jour l'avis de l'utilisateur sur un livre. */
export async function upsertReview(
  bookId: string,
  body: string,
  hasSpoiler: boolean,
): Promise<ActionResult> {
  if (!idValide(bookId)) return ko("Livre introuvable.");
  if (typeof body !== "string") return ko("Avis invalide.");
  if (typeof hasSpoiler !== "boolean") return ko("Valeur invalide.");

  const texte = body.trim();
  if (texte.length < 3) return ko("Écrivez quelques mots avant de publier.");
  if (texte.length > REVIEW_MAX) {
    return ko(`Votre avis dépasse ${REVIEW_MAX} caractères.`);
  }

  const session = await requireSession();
  if (!estSession(session)) return session;
  const { supabase, userId } = session;

  const { error } = await supabase.from("reviews").upsert(
    {
      user_id: userId,
      book_id: bookId,
      body: texte,
      has_spoiler: hasSpoiler,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,book_id" },
  );
  if (error) return ko("Impossible de publier votre avis.");

  revalidateBook(bookId);
  return { ok: true };
}

/** Supprime l'avis de l'utilisateur sur ce livre. */
export async function deleteReview(bookId: string): Promise<ActionResult> {
  if (!idValide(bookId)) return ko("Livre introuvable.");

  const session = await requireSession();
  if (!estSession(session)) return session;
  const { supabase, userId } = session;

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("user_id", userId)
    .eq("book_id", bookId);
  if (error) return ko("Impossible de supprimer votre avis.");

  revalidateBook(bookId);
  return { ok: true };
}

/** Bascule « Utile » sur un avis. `bookId` sert à revalider la fiche. */
export async function toggleReviewLike(
  reviewId: string,
  bookId: string,
): Promise<ActionResult> {
  if (!idValide(reviewId)) return ko("Avis introuvable.");
  if (!idValide(bookId)) return ko("Livre introuvable.");

  const session = await requireSession();
  if (!estSession(session)) return session;
  const { supabase, userId } = session;

  const { data } = await supabase
    .from("review_likes")
    .select("review_id")
    .eq("review_id", reviewId)
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    const { error } = await supabase
      .from("review_likes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", userId);
    if (error) return ko(ERREUR_GENERIQUE);
  } else {
    const { error } = await supabase
      .from("review_likes")
      .insert({ review_id: reviewId, user_id: userId });
    if (error) return ko(ERREUR_GENERIQUE);
  }

  revalidateBook(bookId);
  return { ok: true };
}
