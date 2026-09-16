/**
 * Validations partagées entre le navigateur et le serveur : le même code
 * valide le formulaire au doigt et la Server Action qui écrit en base.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const BIO_MAX = 280;
export const DISPLAY_NAME_MAX = 40;

/** Réservés pour les routes du site : un pseudo ne doit pas les masquer. */
const RESERVED_USERNAMES = new Set([
  "admin",
  "amis",
  "api",
  "auth",
  "bibliotheque",
  "bienvenue",
  "bookclub",
  "communaute",
  "connexion",
  "decouvrir",
  "emprunts",
  "inscription",
  "livre",
  "moi",
  "profil",
  "reglages",
  "support",
]);

/** Met le pseudo sous sa forme canonique (minuscules, sans espaces). */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Renvoie un message d'erreur, ou `null` si le pseudo est acceptable. */
export function validateUsername(raw: string): string | null {
  const value = normalizeUsername(raw);
  if (!value) return "Choisissez un pseudo.";
  if (value.length < USERNAME_MIN)
    return `Au moins ${USERNAME_MIN} caractères.`;
  if (value.length > USERNAME_MAX)
    return `Au plus ${USERNAME_MAX} caractères.`;
  if (!/^[a-z]/.test(value)) return "Le pseudo doit commencer par une lettre.";
  if (RESERVED_USERNAMES.has(value)) return "Ce pseudo est réservé.";
  return null;
}

export function validateEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Indiquez votre adresse e-mail.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))
    return "Cette adresse e-mail ne semble pas valide.";
  return null;
}

export function validatePassword(raw: string): string | null {
  if (!raw) return "Choisissez un mot de passe.";
  if (raw.length < PASSWORD_MIN)
    return `Au moins ${PASSWORD_MIN} caractères.`;
  return null;
}

export type PasswordStrength = {
  /** 0 à 4, pour la jauge. */
  score: number;
  label: string;
  /** Token de couleur sémantique à appliquer à la jauge. */
  tone: "danger" | "accent" | "gold" | "success";
};

/** Indicateur de force volontairement simple : longueur + variété. */
export function passwordStrength(raw: string): PasswordStrength {
  if (!raw) return { score: 0, label: "Vide", tone: "danger" };

  let score = 0;
  if (raw.length >= PASSWORD_MIN) score += 1;
  if (raw.length >= 12) score += 1;
  if (/[a-z]/.test(raw) && /[A-Z]/.test(raw)) score += 1;
  if (/\d/.test(raw) && /[^A-Za-z0-9]/.test(raw)) score += 1;

  if (raw.length < PASSWORD_MIN)
    return { score: 1, label: "Trop court", tone: "danger" };
  if (score <= 1) return { score: 1, label: "Faible", tone: "danger" };
  if (score === 2) return { score: 2, label: "Correct", tone: "accent" };
  if (score === 3) return { score: 3, label: "Solide", tone: "gold" };
  return { score: 4, label: "Excellent", tone: "success" };
}

export function validateDisplayName(raw: string): string | null {
  const value = raw.trim();
  if (value.length > DISPLAY_NAME_MAX)
    return `Au plus ${DISPLAY_NAME_MAX} caractères.`;
  return null;
}

export function validateBio(raw: string): string | null {
  if (raw.trim().length > BIO_MAX) return `Au plus ${BIO_MAX} caractères.`;
  return null;
}

export function validateAvatarUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Indiquez une adresse d'image complète (https://…).";
  }
  if (url.protocol !== "https:") return "L'adresse doit commencer par https://.";
  return null;
}

/**
 * N'accepte qu'un chemin interne : empêche qu'un `?suite=` forgé renvoie
 * l'utilisateur fraîchement connecté vers un site tiers.
 */
export function safeRedirect(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.startsWith("/connexion") || raw.startsWith("/inscription"))
    return fallback;
  return raw;
}
