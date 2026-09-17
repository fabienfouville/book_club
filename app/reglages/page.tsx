import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountPanel } from "@/components/auth/DeleteAccountPanel";
import { ProfileSettingsForm } from "@/components/auth/ProfileSettingsForm";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { DEMO_AUTH_MESSAGE } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: "Réglages",
  description: "Votre profil, votre visibilité, votre thème.",
};

export default async function ReglagesPage() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="space-y-5 py-4">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Réglages
        </h1>
        <DemoNotice />
        <p className="text-sm text-ink-soft">{DEMO_AUTH_MESSAGE}</p>
        <Card className="flex items-center justify-between gap-4">
          <span className="font-semibold">Thème</span>
          <ThemeToggle />
        </Card>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?suite=%2Freglages");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as Profile | null;

  // Profil incomplet : l'accueil est le bon endroit pour le créer.
  if (!profile || !profile.onboarded_at) redirect("/bienvenue");

  return (
    <div className="space-y-6 py-4">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Réglages
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Connecté avec {user.email}.{" "}
          <Link
            href={`/profil/${profile.username}`}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Voir mon profil public
          </Link>
        </p>
      </header>

      <Card>
        <SectionTitle
          title="Mon profil"
          subtitle="Ce que les autres membres voient de vous."
        />
        <ProfileSettingsForm profile={profile} />
      </Card>

      <Card>
        <SectionTitle title="Apparence" subtitle="Clair ou sombre, à votre goût." />
        <div className="flex min-h-[44px] items-center justify-between gap-4">
          <span className="text-sm text-ink-soft">
            Le choix est conservé sur cet appareil.
          </span>
          <ThemeToggle />
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="Compte" />
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            Se déconnecter
          </Button>
        </form>
        <hr className="border-border" />
        <DeleteAccountPanel />
      </Card>
    </div>
  );
}
