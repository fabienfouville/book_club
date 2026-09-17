import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { DEMO_AUTH_MESSAGE } from "@/lib/auth/messages";
import { normalizeUsername } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const metadata: Metadata = {
  title: "Bienvenue",
  description: "Complétez votre profil pour commencer à lire ensemble.",
};

/** Propose un pseudo à partir de l'e-mail, pour n'avoir qu'à le valider. */
function suggestUsername(email?: string | null) {
  if (!email) return "";
  return normalizeUsername(email.split("@")[0] ?? "");
}

export default async function BienvenuePage() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <AuthShell
        title="Bienvenue sur Bookclub"
        subtitle="L'accueil personnalisé attend la configuration de Supabase."
      >
        <div className="space-y-3">
          <DemoNotice />
          <p className="text-sm text-ink-soft">{DEMO_AUTH_MESSAGE}</p>
        </div>
      </AuthShell>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?suite=%2Fbienvenue");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as Profile | null;

  const metadata = user.user_metadata as {
    username?: string;
    display_name?: string;
  };

  return (
    <AuthShell
      title="Bienvenue sur Bookclub"
      subtitle="Trois petites étapes, et votre bibliothèque est à vous."
    >
      <OnboardingForm
        defaultUsername={
          profile?.username ??
          metadata.username ??
          suggestUsername(user.email)
        }
        defaultDisplayName={profile?.display_name ?? metadata.display_name ?? ""}
        defaultGenres={profile?.favorite_genres ?? []}
        currentUsername={profile?.username ?? undefined}
      />
    </AuthShell>
  );
}
