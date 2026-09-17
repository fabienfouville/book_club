import { createClient } from "@/lib/supabase/server";
import { getFriendState } from "@/lib/social/queries";
import { FriendMenu } from "./FriendMenu";

/**
 * Bouton contextuel d'amitié, réutilisable partout où l'on affiche un membre.
 * Composant serveur : il résout lui-même l'état de la relation, l'appelant
 * n'a que le profil à fournir.
 */
export async function FriendButton({
  profileId,
  username,
  size = "md",
  className,
}: {
  profileId: string;
  username: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const supabase = await createClient();
  // Mode démo ou visiteur non connecté : pas d'action sociale possible.
  if (!supabase) return null;

  const { data } = await supabase.auth.getUser();
  const me = data.user;
  if (!me || me.id === profileId) return null;

  const { state } = await getFriendState(supabase, me.id, profileId);

  return (
    <FriendMenu
      profileId={profileId}
      username={username}
      state={state}
      size={size}
      className={className}
    />
  );
}

export default FriendButton;
