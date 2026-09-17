"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/config";
import { destinationAfterAuth } from "@/lib/auth/profile";
import {
  CHECK_INBOX_MESSAGE,
  DEMO_AUTH_MESSAGE,
  translateAuthError,
} from "@/lib/auth/messages";
import type { AuthFormState } from "@/lib/auth/types";
import { safeRedirect, validateEmail } from "@/lib/auth/validation";

/** Connexion classique e-mail + mot de passe. */
export async function signInWithPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const suite = safeRedirect(String(formData.get("suite") ?? ""), "/");

  const fieldErrors: Record<string, string> = {};
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  if (!password) fieldErrors.password = "Saisissez votre mot de passe.";
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Quelques champs sont à corriger.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: DEMO_AUTH_MESSAGE };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: "error", message: translateAuthError(error.message) };

  const destination = await destinationAfterAuth(supabase, suite);
  redirect(destination);
}

/** Connexion sans mot de passe : « lien magique » envoyé par e-mail. */
export async function signInWithMagicLinkAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const suite = safeRedirect(String(formData.get("suite") ?? ""), "/");

  const emailError = validateEmail(email);
  if (emailError) {
    return {
      status: "error",
      message: "Quelques champs sont à corriger.",
      fieldErrors: { email: emailError },
    };
  }

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: DEMO_AUTH_MESSAGE };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // La page de connexion ne crée pas de compte : l'inscription a sa page.
      shouldCreateUser: false,
      emailRedirectTo: `${SITE_URL}/auth/callback?suite=${encodeURIComponent(suite)}`,
    },
  });

  if (error) return { status: "error", message: translateAuthError(error.message) };
  return { status: "sent", message: CHECK_INBOX_MESSAGE };
}
