/** Concatène des classes conditionnelles, sans dépendance. */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
