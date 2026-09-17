"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession, cleanText } from "@/lib/social/guard";
import { getCommunityByCode } from "@/lib/social/queries";
import { slugify, makeInviteCode, normalizeInviteCode } from "@/lib/social/slug";
import type { ActionResult } from "@/lib/social/types";

/** Crée une communauté et en fait immédiatement le propriétaire un membre. */
export async function createCommunity(input: {
  name: string;
  description?: string;
  isOpen: boolean;
}): Promise<ActionResult<{ slug: string }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { supabase, userId } = session;

  const name = cleanText(input?.name, 80);
  if (!name) return { ok: false, error: "Le nom de la communauté est obligatoire." };

  const base = slugify(name) || "communaute";
  let slug = base;
  for (let i = 0; i < 20; i += 1) {
    const { data } = await supabase
      .from("communities")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) break;
    slug = `${base}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  const { data: created, error } = await supabase
    .from("communities")
    .insert({
      slug,
      name,
      description: cleanText(input?.description, 400),
      owner_id: userId,
      invite_code: makeInviteCode(),
      is_open: Boolean(input.isOpen),
    })
    .select("id, slug")
    .single();

  if (error || !created) {
    return { ok: false, error: "La création de la communauté a échoué." };
  }

  await supabase
    .from("community_members")
    .insert({ community_id: created.id, user_id: userId, role: "owner" });

  revalidatePath("/communaute");
  return { ok: true, slug: created.slug as string };
}

/** Rejoint une communauté grâce à son code d'invitation. */
export async function joinCommunityByCode(rawCode: string): Promise<ActionResult<{ slug: string }>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { supabase, userId } = session;

  const code = normalizeInviteCode(rawCode ?? "");
  if (!code) return { ok: false, error: "Saisissez un code d'invitation." };

  // On tente d'abord la fonction SQL dédiée ; à défaut, on rejoint « à la main ».
  const rpc = await supabase.rpc("join_community_by_code", { p_code: code });
  if (!rpc.error) {
    const community = await getCommunityByCode(supabase, code);
    if (community) {
      revalidatePath("/communaute");
      return { ok: true, slug: community.slug };
    }
  }

  const community = await getCommunityByCode(supabase, code);
  if (!community) return { ok: false, error: "Ce code d'invitation n'existe pas." };

  const { data: already } = await supabase
    .from("community_members")
    .select("user_id")
    .eq("community_id", community.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!already) {
    const { error } = await supabase
      .from("community_members")
      .insert({ community_id: community.id, user_id: userId, role: "member" });
    if (error) return { ok: false, error: "Impossible de rejoindre cette communauté." };
  }

  revalidatePath("/communaute");
  return { ok: true, slug: community.slug };
}

/** Variante appelée depuis un formulaire qui redirige elle-même. */
export async function joinCommunityByCodeAndRedirect(formData: FormData) {
  const result = await joinCommunityByCode(String(formData.get("code") ?? ""));
  if (result.ok) redirect(`/communaute/${result.slug}`);
}
