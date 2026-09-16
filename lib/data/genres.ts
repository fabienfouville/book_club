import type { Genre } from "@/types/database";

/** Les genres de Bookclub. `slug` est la clé stable, partagée avec le SQL. */
export const GENRES: Genre[] = [
  { slug: "fantasy", label: "Fantasy", emoji: "🐉", sort_order: 1 },
  { slug: "science-fiction", label: "Science-fiction", emoji: "🚀", sort_order: 2 },
  { slug: "policier", label: "Policier", emoji: "🔎", sort_order: 3 },
  { slug: "thriller", label: "Thriller", emoji: "🗡️", sort_order: 4 },
  { slug: "romance", label: "Romance", emoji: "💗", sort_order: 5 },
  { slug: "classique", label: "Classique", emoji: "🏛️", sort_order: 6 },
  { slug: "litterature", label: "Littérature", emoji: "📖", sort_order: 7 },
  { slug: "historique", label: "Roman historique", emoji: "⏳", sort_order: 8 },
  { slug: "horreur", label: "Horreur", emoji: "🕯️", sort_order: 9 },
  { slug: "aventure", label: "Aventure", emoji: "🧭", sort_order: 10 },
  { slug: "jeunesse", label: "Jeunesse", emoji: "🧸", sort_order: 11 },
  { slug: "young-adult", label: "Young adult", emoji: "🌙", sort_order: 12 },
  { slug: "bd", label: "BD & comics", emoji: "💥", sort_order: 13 },
  { slug: "manga", label: "Manga", emoji: "🍥", sort_order: 14 },
  { slug: "biographie", label: "Biographie", emoji: "🎞️", sort_order: 15 },
  { slug: "essai", label: "Essai", emoji: "💭", sort_order: 16 },
  { slug: "philosophie", label: "Philosophie", emoji: "🦉", sort_order: 17 },
  { slug: "sciences", label: "Sciences", emoji: "🔬", sort_order: 18 },
  { slug: "developpement-personnel", label: "Développement personnel", emoji: "🌱", sort_order: 19 },
  { slug: "cuisine", label: "Cuisine", emoji: "🍲", sort_order: 20 },
  { slug: "voyage", label: "Voyage", emoji: "🗺️", sort_order: 21 },
  { slug: "art", label: "Art & design", emoji: "🎨", sort_order: 22 },
  { slug: "poesie", label: "Poésie", emoji: "🪶", sort_order: 23 },
  { slug: "informatique", label: "Informatique", emoji: "💻", sort_order: 24 },
];

export const GENRE_BY_SLUG = new Map(GENRES.map((g) => [g.slug, g]));

export function genreLabel(slug: string) {
  return GENRE_BY_SLUG.get(slug)?.label ?? slug;
}
