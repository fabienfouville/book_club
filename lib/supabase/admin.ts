import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Client à privilèges élevés, réservé à l'import de livres dans le catalogue
 * partagé (les politiques RLS empêchent un membre d'écrire pour les autres).
 * À n'utiliser que dans du code serveur.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
