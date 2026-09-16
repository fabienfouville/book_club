import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Client Supabase pour les composants serveur et les Server Actions.
 * Renvoie `null` en mode démo, ce qui laisse chaque appelant afficher
 * une version en lecture seule plutôt que de planter.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un composant serveur : le middleware rafraîchit
          // déjà la session, on peut ignorer sans risque.
        }
      },
    },
  });
}

/** Utilisateur connecté, ou `null`. Ne lève jamais. */
export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

/** Profil de l'utilisateur connecté, ou `null`. */
export async function getCurrentProfile() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  return data ?? null;
}
