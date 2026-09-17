import type { BookSource } from "@/types/database";
import { GENRE_BY_SLUG } from "@/lib/data/genres";

/**
 * Forme commune à toutes les sources externes, calquée sur l'interface `Book`
 * du contrat de données : ce qui sort d'ici peut être inséré tel quel dans
 * `books`, à l'exception de `genre_slugs` qui alimente `book_genres`.
 */
export interface ExternalBook {
  source: BookSource;
  source_id: string;
  isbn13: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  cover_url: string | null;
  description: string | null;
  published_year: number | null;
  page_count: number | null;
  language: string | null;
  genre_slugs: string[];
}

/* ------------------------------------------------------- accès défensifs --- */
// Les réponses externes ne sont pas typées : on les traite en `unknown` et on
// n'en retient que ce qui a la forme attendue.

type Rec = Record<string, unknown>;

export function asRecord(value: unknown): Rec | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = str(item);
    if (s) out.push(s);
    // Open Library renvoie parfois des objets { name: "..." }.
    else {
      const rec = asRecord(item);
      const name = rec ? str(rec.name) : null;
      if (name) out.push(name);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ ISBN --- */

function digitsOnly(value: string) {
  return value.replace(/[^0-9Xx]/g, "");
}

/** Convertit un ISBN-10 en ISBN-13 : améliore nettement la déduplication. */
export function isbn10to13(isbn10: string): string | null {
  const core = digitsOnly(isbn10);
  if (core.length !== 10) return null;
  const body = `978${core.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const key = (10 - (sum % 10)) % 10;
  return `${body}${key}`;
}

/** Retient le premier ISBN-13 exploitable d'une liste hétérogène. */
export function pickIsbn13(candidates: string[]): string | null {
  for (const raw of candidates) {
    const core = digitsOnly(raw);
    if (core.length === 13 && /^[0-9]{13}$/.test(core)) return core;
  }
  for (const raw of candidates) {
    const converted = isbn10to13(raw);
    if (converted) return converted;
  }
  return null;
}

/* ----------------------------------------------------------------- langue --- */

const LANGUAGE_MAP: Record<string, string> = {
  fre: "fr",
  fra: "fr",
  fr: "fr",
  eng: "en",
  en: "en",
  spa: "es",
  es: "es",
  ger: "de",
  deu: "de",
  de: "de",
  ita: "it",
  it: "it",
  por: "pt",
  pt: "pt",
  jpn: "ja",
  ja: "ja",
  rus: "ru",
  ru: "ru",
  nld: "nl",
  dut: "nl",
};

export function normalizeLanguage(code: string | null): string | null {
  if (!code) return null;
  const key = code.toLowerCase().trim();
  return LANGUAGE_MAP[key] ?? (key.length >= 2 ? key.slice(0, 2) : null);
}

/* ------------------------------------------------------------- les genres --- */

/** Minuscules, sans accent ni ponctuation : la clé de comparaison des sujets. */
export function normalizeSubject(subject: string) {
  return subject
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Table de correspondance explicite entre les sujets des sources externes
 * (Open Library `subject[]`, Google Books `categories[]`) et les 24 genres
 * maison. Tout ce qui n'est pas reconnu retombe sur « litterature ».
 */
const SUBJECT_TO_GENRE: Record<string, string> = {
  // fantasy
  fantasy: "fantasy",
  "fantasy fiction": "fantasy",
  "epic fantasy": "fantasy",
  "high fantasy": "fantasy",
  "magic": "fantasy",
  "wizards": "fantasy",
  "dragons": "fantasy",
  "witches": "fantasy",
  "fantastique": "fantasy",
  // science-fiction
  "science fiction": "science-fiction",
  "science fiction american": "science-fiction",
  "dystopia": "science-fiction",
  "dystopian": "science-fiction",
  "space opera": "science-fiction",
  "time travel": "science-fiction",
  cyberpunk: "science-fiction",
  "life on other planets": "science-fiction",
  // policier
  "detective and mystery stories": "policier",
  mystery: "policier",
  "mystery fiction": "policier",
  "mystery and detective stories": "policier",
  "detective stories": "policier",
  "crime": "policier",
  "crime fiction": "policier",
  "police procedural": "policier",
  "roman policier": "policier",
  polar: "policier",
  // thriller
  thriller: "thriller",
  thrillers: "thriller",
  suspense: "thriller",
  "suspense fiction": "thriller",
  espionage: "thriller",
  // romance
  romance: "romance",
  "romance fiction": "romance",
  "love stories": "romance",
  "contemporary romance": "romance",
  // classique
  classics: "classique",
  "classic literature": "classique",
  "literature classic": "classique",
  // litterature
  fiction: "litterature",
  literature: "litterature",
  "literary fiction": "litterature",
  "french literature": "litterature",
  "fiction general": "litterature",
  "domestic fiction": "litterature",
  // historique
  "historical fiction": "historique",
  history: "historique",
  "world history": "historique",
  "historical": "historique",
  "france history": "historique",
  // horreur
  horror: "horreur",
  "horror tales": "horreur",
  "horror fiction": "horreur",
  "ghost stories": "horreur",
  vampires: "horreur",
  zombies: "horreur",
  // aventure
  adventure: "aventure",
  "adventure stories": "aventure",
  "adventure and adventurers": "aventure",
  "survival": "aventure",
  // jeunesse
  "juvenile fiction": "jeunesse",
  "juvenile literature": "jeunesse",
  "children s stories": "jeunesse",
  "children s fiction": "jeunesse",
  "picture books": "jeunesse",
  "contes": "jeunesse",
  // young adult
  "young adult fiction": "young-adult",
  "young adult": "young-adult",
  "coming of age": "young-adult",
  // bd
  "comics graphic novels": "bd",
  "graphic novels": "bd",
  comics: "bd",
  "comic books strips": "bd",
  "bande dessinee": "bd",
  // manga
  manga: "manga",
  "comics graphic novels manga": "manga",
  // biographie
  biography: "biographie",
  autobiography: "biographie",
  "biography autobiography": "biographie",
  memoirs: "biographie",
  // essai
  essays: "essai",
  essay: "essai",
  "social science": "essai",
  "political science": "essai",
  "current affairs": "essai",
  // philosophie
  philosophy: "philosophie",
  "philosophie": "philosophie",
  ethics: "philosophie",
  // sciences
  science: "sciences",
  physics: "sciences",
  astronomy: "sciences",
  biology: "sciences",
  mathematics: "sciences",
  cosmology: "sciences",
  nature: "sciences",
  // developpement personnel
  "self help": "developpement-personnel",
  "self actualization psychology": "developpement-personnel",
  "personal growth": "developpement-personnel",
  "body mind spirit": "developpement-personnel",
  spirituality: "developpement-personnel",
  // cuisine
  cooking: "cuisine",
  cookbooks: "cuisine",
  recipes: "cuisine",
  // voyage
  travel: "voyage",
  "voyages and travels": "voyage",
  "description and travel": "voyage",
  // art
  art: "art",
  design: "art",
  photography: "art",
  music: "art",
  painting: "art",
  // poesie
  poetry: "poesie",
  poems: "poesie",
  // informatique
  computers: "informatique",
  programming: "informatique",
  "computer science": "informatique",
  "computer programming": "informatique",
  "software engineering": "informatique",
};

/** Repli par mot-clé, du plus spécifique au plus général. */
const SUBJECT_PATTERNS: Array<[RegExp, string]> = [
  [/\bmanga\b/, "manga"],
  [/graphic novel|\bcomic|bande dessin/, "bd"],
  [/science fiction|sci fi|dystop|\bspace\b|extraterrestr/, "science-fiction"],
  [/fantasy|\bmagic|dragon|wizard|sorcell|sorcier/, "fantasy"],
  [/detective|mystery|\bcrime|police|enquete|polar/, "policier"],
  [/thriller|suspense|espionn|espionage/, "thriller"],
  [/romance|love stor|sentimental/, "romance"],
  [/horror|horreur|terreur|vampire|ghost|fantome/, "horreur"],
  [/historical|history|histoire|historique/, "historique"],
  [/young adult|\bya fiction\b/, "young-adult"],
  [/juvenile|children|enfant|jeunesse|album/, "jeunesse"],
  [/biograph|memoir|autobiograph/, "biographie"],
  [/philosoph/, "philosophie"],
  [/poetry|poesie|poeme|poem/, "poesie"],
  [/cook|cuisine|recipe|gastronom/, "cuisine"],
  [/travel|voyage|tourism/, "voyage"],
  [/comput|programming|informatique|software|algorithm/, "informatique"],
  [/self help|personal growth|developpement personnel|bien etre/, "developpement-personnel"],
  [/\bart\b|design|photograph|peinture|\bmusic/, "art"],
  [/\bscience|physic|biolog|astronom|\bmath|chimie/, "sciences"],
  [/\bessay|\bessai|politic|societ|social/, "essai"],
  [/adventure|aventure/, "aventure"],
  [/classic|classique/, "classique"],
  [/fiction|litterature|literature|\broman\b|novel/, "litterature"],
];

export const DEFAULT_GENRE = "litterature";

/** Traduit une liste de sujets bruts en slugs de genres maison (3 au plus). */
export function mapSubjectsToGenres(subjects: string[], max = 3): string[] {
  const found: string[] = [];

  const push = (slug: string) => {
    if (!GENRE_BY_SLUG.has(slug)) return;
    if (!found.includes(slug)) found.push(slug);
  };

  for (const raw of subjects) {
    if (found.length >= max) break;
    const key = normalizeSubject(raw);
    if (!key) continue;

    const exact = SUBJECT_TO_GENRE[key];
    if (exact) {
      push(exact);
      continue;
    }
    for (const [pattern, slug] of SUBJECT_PATTERNS) {
      if (pattern.test(key)) {
        push(slug);
        break;
      }
    }
  }

  // « Littérature » est le genre fourre-tout : s'il y a plus précis, il passe
  // derrière, car c'est le premier slug qui sert d'étiquette principale.
  const ordered = found.sort((a, b) =>
    a === DEFAULT_GENRE ? 1 : b === DEFAULT_GENRE ? -1 : 0,
  );
  return ordered.length ? ordered.slice(0, max) : [DEFAULT_GENRE];
}

/* ------------------------------------------------------- Open Library ----- */

/** Identifiant stable d'une œuvre Open Library : « OL45883W ». */
function openLibraryId(key: string | null) {
  if (!key) return null;
  const parts = key.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

export function openLibraryCover(coverId: number | null, isbn13: string | null) {
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  if (isbn13) return `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`;
  return null;
}

/** Un document de `https://openlibrary.org/search.json`. */
export function normalizeOpenLibraryDoc(value: unknown): ExternalBook | null {
  const doc = asRecord(value);
  if (!doc) return null;

  const title = str(doc.title);
  const sourceId = openLibraryId(str(doc.key));
  if (!title || !sourceId) return null;

  const isbn13 = pickIsbn13(strArray(doc.isbn).slice(0, 40));
  const coverId = num(doc.cover_i);
  const languages = strArray(doc.language);

  return {
    source: "openlibrary",
    source_id: sourceId,
    isbn13,
    title,
    subtitle: str(doc.subtitle),
    authors: strArray(doc.author_name).slice(0, 5),
    cover_url: openLibraryCover(coverId, isbn13),
    description: str(doc.first_sentence) ?? firstSentence(doc.first_sentence),
    published_year: num(doc.first_publish_year),
    page_count: num(doc.number_of_pages_median),
    language: normalizeLanguage(languages[0] ?? null),
    genre_slugs: mapSubjectsToGenres([
      ...strArray(doc.subject).slice(0, 25),
      ...strArray(doc.subject_facet).slice(0, 10),
    ]),
  };
}

/** `first_sentence` est tantôt une chaîne, tantôt un tableau, tantôt un objet. */
function firstSentence(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string");
    return typeof first === "string" ? first : null;
  }
  const rec = asRecord(value);
  return rec ? str(rec.value) : null;
}

/** La description d'une œuvre : `string` ou `{ type, value }`. */
export function openLibraryDescription(value: unknown): string | null {
  const direct = str(value);
  if (direct) return direct;
  const rec = asRecord(value);
  return rec ? str(rec.value) : null;
}

/* -------------------------------------------------------- Google Books ---- */

function googleCover(imageLinks: unknown): string | null {
  const links = asRecord(imageLinks);
  if (!links) return null;
  const candidate =
    str(links.extraLarge) ??
    str(links.large) ??
    str(links.medium) ??
    str(links.thumbnail) ??
    str(links.smallThumbnail);
  if (!candidate) return null;
  // Google sert du http et une tranche de livre cornée : on nettoie.
  return candidate.replace(/^http:/, "https:").replace(/&edge=curl/, "");
}

function googleIsbn13(identifiers: unknown): string | null {
  if (!Array.isArray(identifiers)) return null;
  const values: string[] = [];
  for (const entry of identifiers) {
    const rec = asRecord(entry);
    const id = rec ? str(rec.identifier) : null;
    if (!id) continue;
    if (str(rec?.type) === "ISBN_13") values.unshift(id);
    else values.push(id);
  }
  return pickIsbn13(values);
}

/** Un élément de `https://www.googleapis.com/books/v1/volumes`. */
export function normalizeGoogleVolume(value: unknown): ExternalBook | null {
  const item = asRecord(value);
  if (!item) return null;
  const info = asRecord(item.volumeInfo);
  const sourceId = str(item.id);
  const title = info ? str(info.title) : null;
  if (!info || !sourceId || !title) return null;

  const publishedDate = str(info.publishedDate);
  const year = publishedDate ? num(publishedDate.slice(0, 4)) : null;

  return {
    source: "googlebooks",
    source_id: sourceId,
    isbn13: googleIsbn13(info.industryIdentifiers),
    title,
    subtitle: str(info.subtitle),
    authors: strArray(info.authors).slice(0, 5),
    cover_url: googleCover(info.imageLinks),
    description: str(info.description),
    published_year: year && year > 0 && year < 2100 ? year : null,
    page_count: num(info.pageCount),
    language: normalizeLanguage(str(info.language)),
    genre_slugs: mapSubjectsToGenres(strArray(info.categories).slice(0, 10)),
  };
}

/* ------------------------------------------------------------ dédup ------- */

/** Clé de repli quand l'ISBN manque : titre + premier auteur, normalisés. */
export function dedupeKey(book: ExternalBook) {
  const title = normalizeSubject(book.title);
  const author = normalizeSubject(book.authors[0] ?? "");
  return `${title}|${author}`;
}

/** Déduplique par ISBN-13 puis par (titre + auteur). Conserve l'ordre. */
export function dedupeExternalBooks(books: ExternalBook[]): ExternalBook[] {
  const byIsbn = new Set<string>();
  const byTitle = new Set<string>();
  const out: ExternalBook[] = [];

  for (const book of books) {
    if (book.isbn13) {
      if (byIsbn.has(book.isbn13)) continue;
      byIsbn.add(book.isbn13);
    }
    const key = dedupeKey(book);
    if (byTitle.has(key)) continue;
    byTitle.add(key);
    out.push(book);
  }
  return out;
}
