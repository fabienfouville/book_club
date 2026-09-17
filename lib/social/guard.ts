import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const DEMO_ERROR =
  "Supabase n'est pas connecté : le mode démo est en lecture seule.";
export const SESSION_ERROR = "Connectez-vous pour effectuer cette action.";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Texte nettoyé et borné ; `null` si vide. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+\n/g, "\n").slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

export type Session =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; error: string };

/** Vérifie la configuration et la session : toute action commence par là. */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: SESSION_ERROR };
  return { ok: true, supabase, userId: data.user.id };
}
