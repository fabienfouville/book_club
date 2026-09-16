export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Bookclub démarre même sans Supabase : le site bascule alors en **mode démo**,
 * en lecture seule, alimenté par le catalogue de démarrage local. Cela permet
 * de déployer et de regarder le site avant d'avoir créé le projet Supabase.
 */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
