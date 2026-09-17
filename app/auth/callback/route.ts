import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { destinationAfterAuth } from "@/lib/auth/profile";
import { safeRedirect } from "@/lib/auth/validation";

/**
 * Retour des liens envoyés par e-mail (confirmation d'inscription et lien
 * magique). On échange le code contre une session, puis on oriente : vers
 * l'onboarding tant que le profil n'est pas complété, sinon vers la page
 * demandée avant la connexion.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const suite = safeRedirect(searchParams.get("suite"), "/");

  const fail = (code: string) =>
    NextResponse.redirect(
      new URL(
        `/connexion?erreur=${code}&suite=${encodeURIComponent(suite)}`,
        request.url,
      ),
    );

  // Supabase renvoie ses propres erreurs dans l'adresse (lien expiré…).
  if (searchParams.get("error")) {
    const code = searchParams.get("error_code") ?? "";
    return fail(/expired|invalid/i.test(code) ? "lien" : "refus");
  }

  const supabase = await createClient();
  if (!supabase) return fail("config");

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("lien");
  } else if (tokenHash && type) {
    // Ancien format de lien (sans PKCE) : vérification directe du jeton.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) return fail("lien");
  } else {
    return fail("lien");
  }

  const destination = await destinationAfterAuth(supabase, suite);
  return NextResponse.redirect(new URL(destination, request.url));
}
