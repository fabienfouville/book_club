"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/config";
import { isUsernameTaken } from "@/lib/auth/profile";
import { DEMO_AUTH_MESSAGE, translateAuthError } from "@/lib/auth/messages";
import type { AuthFormState } from "@/lib/auth/types";
import {
  normalizeUsername,
  safeRedirect,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth/validation";

/** Création de compte e-mail + mot de passe. */
export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rawUsername = String(formData.get("username") ?? "");
  const username = normalizeUsername(rawUsername);
  const suite = safeRedirect(String(formData.get("suite") ?? ""), "/");

  // Mêmes règles que côté client : le navigateur n'est jamais l'arbitre.
  const fieldErrors: Record<string, string> = {};
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  const usernameError = validateUsername(username);
  if (usernameError) fieldErrors.username = usernameError;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Quelques champs sont à corriger.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: DEMO_AUTH_MESSAGE };

  if (await isUsernameTaken(supabase, username)) {
    return {
      status: "error",
      message: "Quelques champs sont à corriger.",
      fieldErrors: { username: "Ce pseudo est déjà pris." },
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Le déclencheur SQL de `profiles` lit ces métadonnées à la création.
      data: { username, display_name: username },
      emailRedirectTo: `${SITE_URL}/auth/callback?suite=${encodeURIComponent(suite)}`,
    },
  });

  if (error) {
    return { status: "error", message: translateAuthError(error.message) };
  }

  // Sans session, la confirmation par e-mail est activée sur le projet.
  if (!data.session) {
    return {
      status: "sent",
      message:
        "Compte créé. Ouvrez le lien de confirmation envoyé à " +
        `${email} pour activer votre compte.`,
    };
  }

  redirect("/bienvenue");
}
