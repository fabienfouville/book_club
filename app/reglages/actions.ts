"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENRE_BY_SLUG } from "@/lib/data/genres";
import { DEMO_AUTH_MESSAGE, translateAuthError } from "@/lib/auth/messages";
import type { AuthFormState } from "@/lib/auth/types";
import {
  validateAvatarUrl,
  validateBio,
  validateDisplayName,
} from "@/lib/auth/validation";

function readGenres(formData: FormData): string[] {
  const raw = String(formData.get("genres") ?? "");
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((slug) => slug.trim())
        .filter((slug) => GENRE_BY_SLUG.has(slug)),
    ),
  ).slice(0, 24);
}

/** Enregistre les modifications du profil. */
export async function updateProfileAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();
  const isPublic = formData.get("is_public") === "on";
  const genres = readGenres(formData);

  const fieldErrors: Record<string, string> = {};
  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) fieldErrors.display_name = displayNameError;
  const bioError = validateBio(bio);
  if (bioError) fieldErrors.bio = bioError;
  const avatarError = validateAvatarUrl(avatarUrl);
  if (avatarError) fieldErrors.avatar_url = avatarError;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Quelques champs sont à corriger.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: DEMO_AUTH_MESSAGE };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?suite=%2Freglages");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      favorite_genres: genres,
      is_public: isPublic,
    })
    .eq("id", user.id);

  if (error) return { status: "error", message: translateAuthError(error.message) };

  revalidatePath("/reglages");
  revalidatePath("/", "layout");
  return { status: "ok", message: "Profil enregistré." };
}

/** Déconnexion : ferme la session puis renvoie à l'accueil public. */
export async function signOutAction() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Suppression du compte. Avec la clé de service, on supprime l'utilisateur
 * d'`auth.users` et la cascade emporte le profil et ses données. Sans elle,
 * on supprime au moins la ligne de profil (la cascade fait le reste) et on
 * ferme la session.
 */
export async function deleteAccountAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const confirmation = String(formData.get("confirmation") ?? "")
    .trim()
    .toUpperCase();
  if (confirmation !== "SUPPRIMER") {
    return {
      status: "error",
      message: "Saisissez SUPPRIMER en majuscules pour confirmer.",
      fieldErrors: { confirmation: "Confirmation incomplète." },
    };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: DEMO_AUTH_MESSAGE };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return { status: "error", message: translateAuthError(error.message) };
  } else {
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) return { status: "error", message: translateAuthError(error.message) };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?compte=supprime");
}
