import type { RecommendationRow } from "@/types/database";
import { GENRE_BY_SLUG } from "@/lib/data/genres";

/** Un libellé de genre peut arriver en slug (`science-fiction`) ou déjà écrit. */
function prettyGenre(label: string) {
  return GENRE_BY_SLUG.get(label)?.label.toLowerCase() ?? label.toLowerCase();
}

/**
 * Transforme le couple (`reason_kind`, `reason_label`) renvoyé par le SQL en
 * une phrase française prête à afficher sous la carte du livre.
 */
export function buildReason(
  kind: RecommendationRow["reason_kind"] | string,
  label: string | null,
): string {
  const value = label?.trim() ? label.trim() : null;

  switch (kind) {
    case "genre":
      return value
        ? `Vous lisez beaucoup de ${prettyGenre(value)}`
        : "Dans vos genres de prédilection";
    case "author":
      return value ? `Parce que vous aimez ${value}` : "Par un auteur que vous suivez";
    case "co_read":
      return value
        ? `Parce que vous avez aimé ${value}`
        : "Aimé par des lecteurs qui vous ressemblent";
    case "friends":
      return value ? `${value} l'a adoré` : "Vos amis en parlent";
    case "popular":
      return value ? `Très aimé en ce moment : ${value}` : "Très apprécié en ce moment";
    default:
      return value ?? "Une piste de lecture pour vous";
  }
}

/** Phrase de légende sous un livre du bloc « Dans le même esprit ». */
export function buildSimilarReason(
  kind: RecommendationRow["reason_kind"] | string,
  label: string | null,
): string {
  const value = label?.trim() ? label.trim() : null;

  switch (kind) {
    case "genre":
      return value ? `Aussi du ${prettyGenre(value)}` : "Un univers proche";
    case "author":
      return value ? `Du même auteur : ${value}` : "Du même auteur";
    case "co_read":
      return "Les lecteurs de ce livre l'ont aimé";
    case "friends":
      return value ? `Recommandé par ${value}` : "Aimé par vos amis";
    case "popular":
      return "Un classique du rayon";
    default:
      return value ?? "Un univers proche";
  }
}
