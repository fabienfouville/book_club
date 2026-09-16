import type { SupabaseClient } from "@supabase/supabase-js";
import { safeRedirect } from "./validation";

/**
 * Le pseudo est-il déjà pris ?
 *
 * La RLS peut masquer les profils privés : une réponse vide ne garantit donc
 * pas la disponibilité. C'est un confort d'interface, la contrainte d'unicité
 * en base reste l'arbitre, et son erreur est traduite à l'enregistrement.
 */
export async function isUsernameTaken(
  supabase: SupabaseClient,
  username: string,
  exceptUserId?: string,
): Promise<boolean> {
  let query = supabase.from("profiles").select("id").eq("username", username);
  if (exceptUserId) query = query.neq("id", exceptUserId);
  const { data, error } = await query.limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Où envoyer quelqu'un qui vient d'ouvrir une session : l'onboarding tant
 * que le profil n'est pas complété, sinon la page demandée.
 */
export async function destinationAfterAuth(
  supabase: SupabaseClient,
  suite?: string | null,
): Promise<string> {
  const target = safeRedirect(suite, "/");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return target;

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  // Pas de ligne de profil (déclencheur SQL absent) ou onboarding inachevé.
  if (!profile || !profile.onboarded_at) return "/bienvenue";
  return target;
}
