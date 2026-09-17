#!/usr/bin/env node
/**
 * Bookclub — recatégorise les livres tombés par défaut en « Littérature ».
 *
 *   node scripts/reclassify-litterature.mjs
 *
 * Cible uniquement les livres dont le genre est EXACTEMENT {litterature}
 * (le repli automatique de l'import) : les classements volontaires ne sont
 * jamais touchés. Recherche chaque livre sur Open Library par titre+auteur,
 * lit ses sujets réels, et les traduit vers nos 24 genres maison.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const file = resolve(ROOT, name);
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Il manque NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const KNOWN_GENRES = new Set([
  "fantasy","science-fiction","policier","thriller","romance","classique","litterature",
  "historique","horreur","aventure","jeunesse","young-adult","bd","manga","biographie",
  "essai","philosophie","sciences","developpement-personnel","cuisine","voyage","art","poesie","informatique",
]);

// Même heuristique que lib/books/normalize.ts, condensée pour ce script autonome.
const PATTERNS = [
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
];

function norm(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function subjectsToGenres(subjects) {
  const found = [];
  for (const raw of subjects) {
    const s = norm(raw);
    for (const [re, genre] of PATTERNS) {
      if (re.test(s) && !found.includes(genre)) found.push(genre);
    }
    if (found.length >= 3) break;
  }
  return found;
}

function isPlausibleMatch(wanted, got) {
  const a = norm(wanted).replace(/[^a-z0-9]+/g, " ").trim();
  const b = norm(got).replace(/[^a-z0-9]+/g, " ").trim();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a) || a.slice(0, 12) === b.slice(0, 12);
}

async function fetchSubjects(title, author) {
  const q = `${title} ${author ?? ""}`.trim();
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=title,subject&limit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  const hit = (data.docs ?? []).find((d) => isPlausibleMatch(title, d.title ?? ""));
  return hit?.subject ?? [];
}

async function main() {
  // 1. Livres dont le SEUL genre est 'litterature'.
  const { data: links, error } = await supabase.from("book_genres").select("book_id, genre_slug");
  if (error) {
    console.error("✗ Lecture de book_genres impossible :", error.message);
    process.exit(1);
  }
  const byBook = new Map();
  for (const row of links) {
    const list = byBook.get(row.book_id) ?? [];
    list.push(row.genre_slug);
    byBook.set(row.book_id, list);
  }
  const targetIds = [...byBook.entries()]
    .filter(([, genres]) => genres.length === 1 && genres[0] === "litterature")
    .map(([id]) => id);

  if (targetIds.length === 0) {
    console.log("Aucun livre n'est classé uniquement en Littérature. Rien à faire.");
    return;
  }

  const { data: books } = await supabase
    .from("books")
    .select("id, title, authors")
    .in("id", targetIds);

  console.log(`${books.length} livre(s) à recatégoriser…\n`);
  let updated = 0;
  let unchanged = 0;

  for (const book of books) {
    process.stdout.write(`• ${book.title} … `);
    let genres = [];
    try {
      const subjects = await fetchSubjects(book.title, book.authors?.[0]);
      genres = subjectsToGenres(subjects).filter((g) => KNOWN_GENRES.has(g));
    } catch {
      // pas de réponse : on laisse tel quel
    }

    if (genres.length === 0) {
      console.log("aucun genre plus précis trouvé, conservé en Littérature");
      unchanged += 1;
    } else {
      await supabase.from("book_genres").delete().eq("book_id", book.id);
      await supabase
        .from("book_genres")
        .insert(genres.map((genre_slug) => ({ book_id: book.id, genre_slug })));
      console.log(`→ ${genres.join(", ")}`);
      updated += 1;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nTerminé : ${updated} recatégorisés, ${unchanged} inchangés.`);
}

main();
