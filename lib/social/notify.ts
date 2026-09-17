import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationKind } from "@/types/database";

export interface NotificationDraft {
  user_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
}

/**
 * Dépose des notifications. Une notification perdue ne doit jamais faire
 * échouer l'action métier qui l'a déclenchée : on n'interrompt donc rien.
 * Si la RLS interdit d'écrire pour autrui et qu'une clé de service est
 * disponible, on repasse par le client à privilèges.
 */
export async function notify(
  supabase: SupabaseClient,
  drafts: NotificationDraft[],
): Promise<void> {
  const rows = drafts.filter((d) => d.user_id);
  if (rows.length === 0) return;

  try {
    const { error } = await supabase.from("notifications").insert(rows);
    if (!error) return;
  } catch {
    // On tente le repli ci-dessous.
  }

  try {
    const admin = createAdminClient();
    if (admin) await admin.from("notifications").insert(rows);
  } catch {
    // Silencieux : la notification est un bonus, pas le cœur de l'action.
  }
}
