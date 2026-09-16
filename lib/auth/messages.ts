/**
 * Traduction des messages d'erreur de Supabase Auth.
 *
 * Supabase répond en anglais : on n'affiche jamais son message brut, sinon
 * l'interface française se retrouve à dire « Invalid login credentials ».
 */

const RULES: Array<{ match: RegExp; message: string }> = [
  {
    match: /invalid login credentials|invalid credentials/i,
    message: "Identifiants incorrects : vérifiez l'adresse e-mail et le mot de passe.",
  },
  {
    match: /email not confirmed/i,
    message:
      "Votre adresse n'est pas encore confirmée. Ouvrez le lien reçu par e-mail, puis réessayez.",
  },
  {
    match: /user already registered|already registered|already been registered/i,
    message: "Cette adresse est déjà utilisée. Connectez-vous plutôt.",
  },
  {
    match: /duplicate key value.*(profiles_username|username)/i,
    message: "Ce pseudo est déjà pris, choisissez-en un autre.",
  },
  {
    match: /duplicate key value/i,
    message: "Cette information est déjà utilisée par un autre compte.",
  },
  {
    match: /password should be at least|password.*too short|weak password/i,
    message: "Le mot de passe doit contenir au moins 8 caractères.",
  },
  {
    match: /new password should be different/i,
    message: "Le nouveau mot de passe doit être différent de l'ancien.",
  },
  {
    match: /unable to validate email address|invalid email|email address.*invalid/i,
    message: "Cette adresse e-mail ne semble pas valide.",
  },
  {
    match: /signups not allowed|signup is disabled/i,
    message: "Les inscriptions sont momentanément fermées.",
  },
  {
    match: /email rate limit|over_email_send_rate_limit|too many requests|rate limit/i,
    message:
      "Trop de tentatives d'affilée. Patientez une minute avant de réessayer.",
  },
  {
    match: /token has expired|otp_expired|expired or is invalid|invalid.*token/i,
    message:
      "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau, il est valable une heure.",
  },
  {
    match: /auth session missing|session.*not found|refresh.*token/i,
    message: "Votre session a expiré. Reconnectez-vous.",
  },
  {
    match: /user not found/i,
    message: "Aucun compte ne correspond à cette adresse.",
  },
  {
    match: /captcha/i,
    message: "La vérification anti-robot a échoué. Rechargez la page et réessayez.",
  },
  {
    match: /row-level security|permission denied|not authorized/i,
    message: "Vous n'avez pas les droits nécessaires pour cette action.",
  },
  {
    match: /fetch failed|network|failed to fetch|timeout/i,
    message: "Connexion au serveur impossible. Vérifiez votre réseau et réessayez.",
  },
];

/** Message français prêt à afficher pour une erreur Supabase. */
export function translateAuthError(raw?: string | null): string {
  if (!raw) return "Une erreur inattendue s'est produite. Réessayez.";
  const found = RULES.find((rule) => rule.match.test(raw));
  return (
    found?.message ??
    "Une erreur inattendue s'est produite. Réessayez dans un instant."
  );
}

/** Encart affiché partout où Supabase n'est pas configuré (mode démo). */
export const DEMO_AUTH_MESSAGE =
  "Les comptes seront disponibles une fois Supabase configuré. En attendant, " +
  "Bookclub fonctionne en lecture seule.";

export const CHECK_INBOX_MESSAGE =
  "Vérifiez votre boîte mail : le lien de connexion vient de partir. " +
  "Pensez à regarder dans les indésirables.";
