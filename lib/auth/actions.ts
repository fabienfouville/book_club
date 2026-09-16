"use server";

import { createClient } from "@/lib/supabase/server";
import { isUsernameTaken } from "./profile";
import { normalizeUsername, validateUsername } from "./validation";

export type UsernameCheck = {
  username: string;
  available: boolean;
  /** Message à afficher sous le champ, ou `null` si tout va bien. */
  error: string | null;
};

/** Vérification en direct du pseudo pendant la saisie. */
export async function checkUsernameAvailability(
  raw: string,
): Promise<UsernameCheck> {
  const username = normalizeUsername(raw);
  const invalid = validateUsername(username);
  if (invalid) return { username, available: false, error: invalid };

  const supabase = await createClient();
  // Mode démo : on ne peut rien vérifier, on ne bloque pas la saisie.
  if (!supabase) return { username, available: true, error: null };

  const taken = await isUsernameTaken(supabase, username);
  return {
    username,
    available: !taken,
    error: taken ? "Ce pseudo est déjà pris." : null,
  };
}
