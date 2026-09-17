"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Friendship } from "@/types/database";
import { isUuid, requireSession } from "@/lib/social/guard";
import { notify } from "@/lib/social/notify";
import {
  PROFILE_FIELDS,
  getFriendIds,
  personName,
} from "@/lib/social/queries";
import type { ActionResult, ProfileLite } from "@/lib/social/types";

function refreshSocialPages() {
  revalidatePath("/amis");
  revalidatePath("/profil/[username]", "page");
  revalidatePath("/amis/[username]", "page");
}

/** Relation entre deux membres, quel que soit le sens. */
async function findFriendship(
  supabase: SupabaseClient,
  a: string,
  b: string,
): Promise<Friendship | null> {
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),` +
        `and(requester_id.eq.${b},addressee_id.eq.${a})`,
    )
    .limit(1)
    .maybeSingle();
  return (data as Friendship | null) ?? null;
}

async function loadProfile(
  supabase: SupabaseClient,
  id: string,
): Promise<ProfileLite | null> {
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return (data as ProfileLite | null) ?? null;
}

/** Envoie une demande d'ami. */
export async function sendFriendRequest(
  profileId: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!isUuid(profileId)) return { ok: false, error: "Membre introuvable." };
  if (profileId === session.userId)
    return { ok: false, error: "Vous ne pouvez pas vous ajouter vous-même." };

  const { supabase, userId } = session;
  const target = await loadProfile(supabase, profileId);
  if (!target) return { ok: false, error: "Ce membre n'existe pas." };

  const existing = await findFriendship(supabase, userId, profileId);
  if (existing) {
    if (existing.status === "accepted")
      return { ok: false, error: "Vous êtes déjà amis." };
    if (existing.status === "blocked")
      return { ok: false, error: "Cette demande n'est pas possible." };
    if (existing.addressee_id === userId)
      return {
        ok: false,
        error: "Cette personne vous a déjà invité : acceptez sa demande.",
      };
    return { ok: false, error: "Demande déjà envoyée." };
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: userId,
    addressee_id: profileId,
    status: "pending",
  });
  if (error) return { ok: false, error: "L'envoi de la demande a échoué." };

  const me = await loadProfile(supabase, userId);
  await notify(supabase, [
    {
      user_id: profileId,
      kind: "friend_request",
      payload: {
        from_user: userId,
        username: me?.username ?? null,
        name: personName(me),
      },
    },
  ]);

  refreshSocialPages();
  return { ok: true };
}

/** Accepte une demande reçue. Seul le destinataire le peut. */
export async function acceptFriendRequest(
  profileId: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!isUuid(profileId)) return { ok: false, error: "Membre introuvable." };

  const { supabase, userId } = session;
  const existing = await findFriendship(supabase, userId, profileId);
  if (!existing || existing.status !== "pending")
    return { ok: false, error: "Cette demande n'existe plus." };
  if (existing.addressee_id !== userId)
    return {
      ok: false,
      error: "Seule la personne invitée peut accepter cette demande.",
    };

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { ok: false, error: "L'acceptation a échoué." };

  const me = await loadProfile(supabase, userId);
  await notify(supabase, [
    {
      user_id: existing.requester_id,
      kind: "friend_accepted",
      payload: {
        from_user: userId,
        username: me?.username ?? null,
        name: personName(me),
      },
    },
  ]);

  refreshSocialPages();
  return { ok: true };
}

/** Refuse une demande reçue : la relation est effacée, elle reste rejouable. */
export async function declineFriendRequest(
  profileId: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!isUuid(profileId)) return { ok: false, error: "Membre introuvable." };

  const { supabase, userId } = session;
  const existing = await findFriendship(supabase, userId, profileId);
  if (!existing || existing.status !== "pending")
    return { ok: false, error: "Cette demande n'existe plus." };
  if (existing.addressee_id !== userId)
    return { ok: false, error: "Cette demande ne vous est pas adressée." };

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", existing.id);
  if (error) return { ok: false, error: "Le refus a échoué." };

  refreshSocialPages();
  return { ok: true };
}

/** Annule une demande que j'ai envoyée. */
export async function cancelFriendRequest(
  profileId: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!isUuid(profileId)) return { ok: false, error: "Membre introuvable." };

  const { supabase, userId } = session;
  const existing = await findFriendship(supabase, userId, profileId);
  if (!existing || existing.status !== "pending")
    return { ok: false, error: "Cette demande n'existe plus." };
  if (existing.requester_id !== userId)
    return { ok: false, error: "Vous n'êtes pas à l'origine de cette demande." };

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", existing.id);
  if (error) return { ok: false, error: "L'annulation a échoué." };

  refreshSocialPages();
  return { ok: true };
}

/** Retire un ami. */
export async function removeFriend(profileId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (!isUuid(profileId)) return { ok: false, error: "Membre introuvable." };

  const { supabase, userId } = session;
  const existing = await findFriendship(supabase, userId, profileId);
  if (!existing || existing.status !== "accepted")
    return { ok: false, error: "Vous n'êtes pas amis avec ce membre." };

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", existing.id);
  if (error) return { ok: false, error: "Le retrait a échoué." };

  refreshSocialPages();
  return { ok: true };
}

/** Liste mes amis acceptés — utilisée par les dialogues côté client. */
export async function listMyFriends(): Promise<
  ActionResult<{ friends: ProfileLite[] }>
> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { supabase, userId } = session;

  const friendIds = await getFriendIds(supabase, userId);
  if (friendIds.length === 0) return { ok: true, friends: [] };

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .in("id", friendIds);
  const friends = ((data ?? []) as ProfileLite[]).sort((a, b) =>
    personName(a).localeCompare(personName(b), "fr"),
  );
  return { ok: true, friends };
}
