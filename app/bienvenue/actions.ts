"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GENRE_BY_SLUG } from "@/lib/data/genres";
import { isUsernameTaken } from "@/lib/auth/profile";
import { DEMO_AUTH_MESSAGE, translateAuthError } from "@/lib/auth/messages";
import type { AuthFormState } from "@/lib/auth/types";
import {
  normalizeUsername,
  validateDisplayName,
  validateUsername,
} from "@/lib/auth/validation";

/** Lit la liste de genres transmise par le formulaire et écarte les inconnus. */
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

/** Étape finale de l'accueil : complète le profil et pose `onboarded_at`. */
export async function completeOnboardingAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const displayName = String(formData.get("display_name") ?? "").trim();
  const genres = readGenres(formData);

  const fieldErrors: Record<string, string> = {};
  const usernameError = validateUsername(username);
  if (usernameError) fieldErrors.username = usernameError;
  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) fieldErrors.display_name = displayNameError;

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
  if (!user) redirect("/connexion?suite=%2Fbienvenue");

  if (await isUsernameTaken(supabase, username, user.id)) {
    return {
      status: "error",
      message: "Quelques champs sont à corriger.",
      fieldErrors: { username: "Ce pseudo est déjà pris." },
    };
  }

  // `upsert` : le profil existe déjà si le déclencheur SQL l'a créé à
  // l'inscription, mais l'onboarding reste possible s'il manque.
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      display_name: displayName || username,
      favorite_genres: genres,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return { status: "error", message: translateAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/decouvrir");
}
