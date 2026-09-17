import type { Metadata } from "next";
import { AuthFooterLink, AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { createClient } from "@/lib/supabase/server";
import { DEMO_AUTH_MESSAGE, callbackErrorMessage } from "@/lib/auth/messages";
import { safeRedirect } from "@/lib/auth/validation";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Retrouvez votre bibliothèque, vos amis et vos recommandations.",
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>;
}) {
  const { suite, erreur } = await searchParams;
  const supabase = await createClient();
  const destination = safeRedirect(suite, "/");

  return (
    <AuthShell
      title="Bon retour"
      subtitle="Connectez-vous pour retrouver vos étagères."
      footer={
        <AuthFooterLink
          href={`/inscription?suite=${encodeURIComponent(destination)}`}
          label="Pas encore de compte ?"
          cta="Créer un compte"
        />
      }
    >
      {supabase ? (
        <SignInForm
          suite={destination}
          initialError={callbackErrorMessage(erreur)}
        />
      ) : (
        <div className="space-y-3">
          <DemoNotice />
          <p className="text-sm text-ink-soft">{DEMO_AUTH_MESSAGE}</p>
        </div>
      )}
    </AuthShell>
  );
}
