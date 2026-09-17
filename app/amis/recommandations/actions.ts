"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recommendation } from "@/types/database";
import { cleanText, isUuid, requireSession } from "@/lib/social/guard";
import { notify } from "@/lib/social/notify";
import {
  PROFILE_FIELDS,
  getFriendIds,
  personName,
} from "@/lib/social/queries";
import type { ActionResult, ProfileLite } from "@/lib/social/types";

const MESSAGE_MAX = 500;

/** Recommande un livre à un ou plusieurs amis. */
export async function recommendBook(input: {
  bookId: string;
  friendIds: string[];
  message?: string;
}): Promise<ActionResult<{ sent: number }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { supabase, userId } = session;

  if (!isUuid(input?.bookId)) return { ok: false, error: "Livre introuvable." };

  const targets = [...new Set((input?.friendIds ?? []).filter(isUuid))];
  if (targets.length === 0)
    return { ok: false, error: "Choisissez au moins un ami." };
  if (targets.length > 20)
    return { ok: false, error: "Vingt amis au maximum par envoi." };

  const friendIds = new Set(await getFriendIds(supabase, userId));
  const allowed = targets.filter((id) => friendIds.has(id));
  if (allowed.length === 0)
    return {
      ok: false,
      error: "Vous ne pouvez recommander qu'à vos amis acceptés.",
    };

  const message = cleanText(input?.message, MESSAGE_MAX);

  // On évite d'envoyer deux fois le même livre à la même personne.
  const { data: existing } = await supabase
    .from("recommendations")
    .select("to_user")
    .eq("from_user", userId)
    .eq("book_id", input.bookId)
    .in("to_user", allowed);
  const already = new Set(
    ((existing ?? []) as Array<{ to_user: string }>).map((r) => r.to_user),
  );
  const fresh = allowed.filter((id) => !already.has(id));

  if (fresh.length === 0)
    return {
      ok: false,
      error: "Ce livre a déjà été recommandé à ces personnes.",
    };

  const { error } = await supabase.from("recommendations").insert(
    fresh.map((to) => ({
      from_user: userId,
      to_user: to,
      book_id: input.bookId,
      message,
      status: "sent",
    })),
  );
  if (error) return { ok: false, error: "L'envoi de la recommandation a échoué." };

  const { data: meRow } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", userId)
    .maybeSingle();
  const me = (meRow as ProfileLite | null) ?? null;

  await notify(
    supabase,
    fresh.map((to) => ({
      user_id: to,
      kind: "recommendation" as const,
      payload: {
        from_user: userId,
        username: me?.username ?? null,
        name: personName(me),
        book_id: input.bookId,
        message,
      },
    })),
  );

  revalidatePath("/amis/recommandations");
  return { ok: true, sent: fresh.length };
}

async function loadReceived(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<Recommendation | null> {
  const { data } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .eq("to_user", userId)
    .maybeSingle();
  return (data as Recommendation | null) ?? null;
}

/** « Ajouter à ma liste » : le livre rejoint l'étagère « Envie de lire ». */
export async function saveRecommendation(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!isUuid(id)) return { ok: false, error: "Recommandation introuvable." };
  const { supabase, userId } = session;

  const reco = await loadReceived(supabase, id, userId);
  if (!reco) return { ok: false, error: "Cette recommandation n'existe plus." };

  const { error: shelfError } = await supabase.from("library_items").upsert(
    {
      user_id: userId,
      book_id: reco.book_id,
      shelf: "wishlist",
    },
    { onConflict: "user_id,book_id", ignoreDuplicates: true },
  );
  if (shelfError)
    return { ok: false, error: "Impossible d'ajouter ce livre à votre liste." };

  await supabase
    .from("recommendations")
    .update({ status: "saved" })
    .eq("id", id)
    .eq("to_user", userId);

  revalidatePath("/amis/recommandations");
  revalidatePath("/bibliotheque");
  return { ok: true };
}

/** « Écarter » : la recommandation quitte la boîte de réception. */
export async function dismissRecommendation(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!isUuid(id)) return { ok: false, error: "Recommandation introuvable." };
  const { supabase, userId } = session;

  const { error } = await supabase
    .from("recommendations")
    .update({ status: "dismissed" })
    .eq("id", id)
    .eq("to_user", userId);
  if (error) return { ok: false, error: "L'action a échoué." };

  revalidatePath("/amis/recommandations");
  return { ok: true };
}
