import type { Metadata } from "next";
import { AuthFooterLink, AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { createClient } from "@/lib/supabase/server";
import { DEMO_AUTH_MESSAGE } from "@/lib/auth/messages";
import { safeRedirect } from "@/lib/auth/validation";

export const metadata: Metadata = {
  title: "Créer un compte",
  description:
    "Rejoignez Bookclub : notez vos lectures, écrivez vos avis et partagez vos livres.",
};

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  const supabase = await createClient();
  const destination = safeRedirect(suite, "/");

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Trois informations, et votre bibliothèque commence."
      footer={
        <AuthFooterLink
          href={`/connexion?suite=${encodeURIComponent(destination)}`}
          label="Vous avez déjà un compte ?"
          cta="Se connecter"
        />
      }
    >
      {supabase ? (
        <SignUpForm suite={destination} />
      ) : (
        <div className="space-y-3">
          <DemoNotice />
          <p className="text-sm text-ink-soft">{DEMO_AUTH_MESSAGE}</p>
        </div>
      )}
    </AuthShell>
  );
}
