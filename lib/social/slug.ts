/** Alphabet sans caractères ambigus (ni 0/O, ni 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Dérive un identifiant d'URL lisible à partir d'un nom libre. */
export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Code d'invitation court, lisible à voix haute et sans confusion possible. */
export function makeInviteCode(length = 8) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Normalise un code saisi à la main (espaces, tirets, minuscules). */
export function normalizeInviteCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}
