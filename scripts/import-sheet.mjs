#!/usr/bin/env node
/**
 * Bookclub — import d'une bibliothèque personnelle depuis un Google Sheet.
 *
 *   IMPORT_MODE=apercu node scripts/import-sheet.mjs   (simulation, aucune écriture)
 *   IMPORT_MODE=import node scripts/import-sheet.mjs   (écrit en base)
 *
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * GOOGLE_SHEET_ID, BOOKCLUB_PSEUDO.
 *
 * Principes :
 * - Le tableau fait foi : titre, auteur, genre, statut et date viennent de lui.
 * - Une source externe (Open Library, puis Google Books) n'est retenue que si
 *   TITRE ET AUTEUR concordent — c'est ce qui empêche une couverture ou une
 *   fiche d'un autre livre. Sans auteur dans le tableau, pas de recherche
 *   externe : fiche simple, sans couverture, plutôt qu'un risque d'erreur.
 * - Relançable sans doublon : les livres existants sont réutilisés, les
 *   entrées de bibliothèque sont mises à jour.
 * - CONFIDENTIALITÉ : le dépôt est public, donc les logs aussi. Aucun titre
 *   ni auteur n'est affiché — seulement des compteurs et des numéros de ligne.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env.local", ".env"]) {
  const file = resolve(ROOT, name);
  if (!existsSync(file)) continue;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    const eq = line.indexOf("=");
    if (!line || line.startsWith("#") || eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

const MODE = process.env.IMPORT_MODE === "import" ? "import" : "apercu";
const { NEXT_PUBLIC_SUPABASE_URL: URL_SB, SUPABASE_SERVICE_ROLE_KEY: KEY, GOOGLE_SHEET_ID: SHEET, BOOKCLUB_PSEUDO: PSEUDO } =
  process.env;
for (const [nom, val] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: URL_SB, SUPABASE_SERVICE_ROLE_KEY: KEY, GOOGLE_SHEET_ID: SHEET, BOOKCLUB_PSEUDO: PSEUDO })) {
  if (!val && process.env.IMPORT_TEST !== "1") {
    console.error(`✗ Variable manquante : ${nom}`);
    process.exit(1);
  }
}
const db = process.env.IMPORT_TEST === "1" ? null : createClient(URL_SB, KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ CSV --- */

function splitRows(text) {
  const rows = [];
  let cur = "";
  let q = false;
  for (const c of text) {
    if (c === '"') q = !q;
    if (c === "\n" && !q) {
      rows.push(cur.replace(/\r$/, ""));
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) rows.push(cur.replace(/\r$/, ""));
  return rows;
}

function splitCells(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/* ------------------------------------------------------------ normalisation */

const norm = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const lastWord = (s) => norm(s).split(" ").filter(Boolean).pop() ?? "";

/** Titre : égalité, ou inclusion SANS écart de tome/volume (sinon « tome 2 »
 * serait rattaché au tome 1). Tolère un sous-titre ajouté. */
function titleMatches(wanted, got) {
  const a = norm(wanted);
  const b = norm(got);
  if (!a || !b) return false;
  if (a === b) return true;
  if (!(a.includes(b) || b.includes(a))) return false;
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  const extra = long.replace(short, " ");
  return !/\b(tome|t|vol|volume|livre|partie|part|book|episode|\d+)\b/.test(extra);
}

const nameTokens = (s) => norm(s).split(" ").filter((t) => t.length > 2);

/** Auteur : inclusion, ou nom de famille retrouvé dans l'autre nom — tolère
 * « Coelho, Paulo » face à « Paulo Coelho ». Un prénom commun seul ne suffit
 * jamais (« Stephen King » ≠ « Stephen Hawking »). */
function authorMatches(wanted, got) {
  const w = norm(wanted);
  const wl = lastWord(wanted);
  const wt = nameTokens(wanted);
  return (got ?? []).some((g) => {
    const n = norm(g);
    if (!n || !w) return false;
    if (n.includes(w) || w.includes(n)) return true;
    const gl = lastWord(g);
    return (wl.length > 2 && nameTokens(g).includes(wl)) || (gl.length > 2 && wt.includes(gl));
  });
}

const SHELF = [
  [/^(lu|lue|termine|fini|finie)$/, "read"],
  [/^en cours/, "reading"],
  [/^abandon/, "abandoned"],
];
function toShelf(statut, hasDate) {
  const s = norm(statut);
  for (const [re, shelf] of SHELF) if (re.test(s)) return shelf;
  if (!s && hasDate) return "read";
  return "wishlist"; // « Pas commencé », « À lire », vide…
}
const SHELF_RANK = { read: 4, reading: 3, abandoned: 2, wishlist: 1 };

/** Dates françaises : 01/11/2023, 01/11/23, 01/11/2023 14:30, 11/2023, 2023-11-01. */
function toDate(raw) {
  const s = (raw ?? "").trim();
  if (!s) return { value: null, invalid: false };
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2})[:h](\d{2}))?/);
  if (m) {
    let [, d, mo, y, hh, mi] = m;
    d = +d;
    mo = +mo;
    y = +y < 100 ? 2000 + +y : +y;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // saisie au format américain
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > 2100) return { value: null, invalid: true };
    const p = (n) => String(n).padStart(2, "0");
    return { value: `${y}-${p(mo)}-${p(d)}T${hh ? `${p(+hh)}:${mi}` : "12:00"}:00Z`, invalid: false };
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { value: `${m[1]}-${m[2]}-${m[3]}T12:00:00Z`, invalid: false };
  m = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { value: `${m[2]}-${String(+m[1]).padStart(2, "0")}-01T12:00:00Z`, invalid: false };
  return { value: null, invalid: true };
}

/** Note : « 4 », « 4/5 », « 8/10 », « 16/20 », « ★★★★ » → entier 1..5. */
function toRating(raw) {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const stars = (s.match(/[★⭐]/g) ?? []).length;
  if (stars) return Math.min(5, stars);
  const m = s.replace(",", ".").match(/(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?/);
  if (!m) return null;
  const n = +m[1];
  const scale = m[2] ? +m[2] : n > 5 ? 10 : 5;
  const r = Math.round((n / scale) * 5);
  return r >= 1 && r <= 5 ? r : null;
}

const LANG = { francais: "fr", anglais: "en", espagnol: "es", italien: "it", allemand: "de", portugais: "pt", english: "en", french: "fr" };

const GENRE_EXACT = {
  roman: "litterature", litterature: "litterature", fiction: "litterature", "roman contemporain": "litterature",
  "litterature generale": "litterature", nouvelle: "litterature", nouvelles: "litterature", theatre: "litterature", "feel good": "litterature",
  "science fiction": "science-fiction", sf: "science-fiction", dystopie: "science-fiction", anticipation: "science-fiction",
  fantasy: "fantasy", fantastique: "fantasy", merveilleux: "fantasy", "fantasy urbaine": "fantasy",
  policier: "policier", polar: "policier", "roman policier": "policier", enquete: "policier", "roman noir": "policier",
  thriller: "thriller", suspense: "thriller", espionnage: "thriller",
  romance: "romance", "new romance": "romance", "roman d amour": "romance", romantasy: "romance",
  classique: "classique", classiques: "classique",
  historique: "historique", "roman historique": "historique", histoire: "historique",
  horreur: "horreur", epouvante: "horreur",
  aventure: "aventure", aventures: "aventure",
  jeunesse: "jeunesse", "litterature jeunesse": "jeunesse", enfant: "jeunesse", conte: "jeunesse", contes: "jeunesse",
  "young adult": "young-adult", ya: "young-adult",
  bd: "bd", "bande dessinee": "bd", comics: "bd", "roman graphique": "bd",
  manga: "manga",
  biographie: "biographie", autobiographie: "biographie", memoires: "biographie", temoignage: "biographie", "recit autobiographique": "biographie", recit: "biographie",
  essai: "essai", societe: "essai", politique: "essai", sociologie: "essai", economie: "essai", psychologie: "essai", documentaire: "essai",
  philosophie: "philosophie", philo: "philosophie",
  science: "sciences", sciences: "sciences", "vulgarisation scientifique": "sciences",
  "developpement personnel": "developpement-personnel", "dev perso": "developpement-personnel", "bien etre": "developpement-personnel", spiritualite: "developpement-personnel",
  cuisine: "cuisine", voyage: "voyage", "recit de voyage": "voyage",
  art: "art", arts: "art", photographie: "art", musique: "art", "beau livre": "art",
  poesie: "poesie", informatique: "informatique", programmation: "informatique",
};
const GENRE_PATTERNS = [
  [/science ?fiction|dystop/, "science-fiction"], [/fantasy|fantastique/, "fantasy"], [/polic|polar|enquet/, "policier"],
  [/thriller|suspense/, "thriller"], [/romance|amour/, "romance"], [/histori/, "historique"], [/horreur|epouvant/, "horreur"],
  [/aventur/, "aventure"], [/jeunesse|enfant/, "jeunesse"], [/young|\bya\b/, "young-adult"], [/manga/, "manga"],
  [/bande dessin|\bbd\b|comic/, "bd"], [/biograph|memoire|temoign/, "biographie"], [/philo/, "philosophie"],
  [/essai|societ|politi/, "essai"], [/developpement|bien etre/, "developpement-personnel"], [/poes/, "poesie"],
  [/voyage/, "voyage"], [/cuisine/, "cuisine"], [/scien/, "sciences"], [/classique/, "classique"], [/roman|litter/, "litterature"],
];

const unmappedGenres = new Map();
function toGenres(raw) {
  const out = [];
  for (const part of (raw ?? "").split(/[,;/+&|]| et /i)) {
    const n = norm(part);
    if (!n) continue;
    let g = GENRE_EXACT[n];
    if (!g) for (const [re, slug] of GENRE_PATTERNS) if (re.test(n)) { g = slug; break; }
    if (g) {
      if (!out.includes(g)) out.push(g);
      if (n === "romantasy" && !out.includes("fantasy")) out.push("fantasy");
    } else unmappedGenres.set(part.trim(), (unmappedGenres.get(part.trim()) ?? 0) + 1);
  }
  return out.slice(0, 3);
}

/* ------------------------------------------------------ sources externes --- */

const SUBJECT_PATTERNS = GENRE_PATTERNS.filter(([, g]) => g !== "litterature").concat([
  [/detective|mystery|crime/, "policier"], [/love stor/, "romance"], [/magic|dragon|wizard/, "fantasy"],
  [/juvenile|children/, "jeunesse"], [/comic|graphic novel/, "bd"], [/memoir|autobiograph/, "biographie"],
]);
function subjectsToGenres(subjects) {
  const out = [];
  for (const s of subjects ?? []) {
    const n = norm(s);
    for (const [re, g] of SUBJECT_PATTERNS) if (re.test(n) && !out.includes(g)) out.push(g);
    if (out.length >= 3) break;
  }
  return out;
}

async function getJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { "user-agent": "Bookclub/1.0 (import de bibliotheque)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function findExternal(title, author) {
  const q = encodeURIComponent(`${title} ${author}`);
  try {
    const data = await getJson(
      `https://openlibrary.org/search.json?q=${q}&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject&limit=8`,
    );
    const hit = (data.docs ?? []).find((d) => titleMatches(title, d.title) && authorMatches(author, d.author_name));
    if (hit?.key) {
      return {
        source: "openlibrary",
        source_id: hit.key.split("/").filter(Boolean).pop(),
        cover_url: hit.cover_i ? `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg` : null,
        published_year: hit.first_publish_year ?? null,
        page_count: hit.number_of_pages_median ?? null,
        genres: subjectsToGenres(hit.subject),
      };
    }
  } catch {
    // on tente Google Books
  }
  try {
    const data = await getJson(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=8&printType=books`);
    const hit = (data.items ?? []).find(
      (it) => titleMatches(title, it.volumeInfo?.title) && authorMatches(author, it.volumeInfo?.authors),
    );
    if (hit?.id) {
      const img = hit.volumeInfo?.imageLinks;
      const cover = img?.thumbnail || img?.smallThumbnail || null;
      return {
        source: "googlebooks",
        source_id: hit.id,
        cover_url: cover ? cover.replace(/^http:/, "https:") : null,
        published_year: Number.parseInt(hit.volumeInfo?.publishedDate ?? "", 10) || null,
        page_count: hit.volumeInfo?.pageCount ?? null,
        genres: subjectsToGenres(hit.volumeInfo?.categories),
      };
    }
  } catch {
    // aucune source n'a répondu
  }
  return null;
}

/* ---------------------------------------------------------- lecture sheet */

async function readSheet() {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET}/export?format=csv`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Google Sheet inaccessible (HTTP ${res.status})`);
  const rows = splitRows(await res.text()).map(splitCells);

  const headerIdx = rows.findIndex((r) => r.some((c) => ["livre", "titre"].includes(norm(c))));
  if (headerIdx === -1) throw new Error("Ligne d'en-têtes introuvable (colonne « Livre » ou « Titre »).");
  const header = rows[headerIdx].map(norm);

  // Plusieurs tableaux peuvent cohabiter côte à côte : un par colonne « Livre ».
  const tables = [];
  header.forEach((h, i) => {
    if (h !== "livre" && h !== "titre") return;
    const cols = { title: i };
    for (let j = i + 1; j < header.length && header[j]; j += 1) {
      const k = header[j];
      if (k.startsWith("auteur") && cols.author === undefined && !k.includes("suivre")) cols.author = j;
      else if (k.startsWith("genre") || k.startsWith("categorie")) cols.genre = j;
      else if (k.startsWith("langue")) cols.lang = j;
      else if (k.startsWith("statut") || k.startsWith("etat")) cols.status = j;
      else if (k.startsWith("date")) cols.date = j;
      else if (k.startsWith("note")) cols.rating = j;
      else if (header[j] === "livre" || header[j] === "titre") break;
    }
    tables.push(cols);
  });

  const records = [];
  const invalidDates = [];
  rows.slice(headerIdx + 1).forEach((cells, k) => {
    const line = headerIdx + 2 + k; // numéro de ligne tel qu'affiché dans Google Sheets
    tables.forEach((c, t) => {
      const title = cells[c.title]?.trim();
      if (!title) return;
      const date = toDate(cells[c.date]);
      if (date.invalid) invalidDates.push(`${line}`);
      records.push({
        line,
        table: t + 1,
        title,
        author: cells[c.author]?.trim() ?? "",
        genres: toGenres(cells[c.genre]),
        lang: LANG[norm(cells[c.lang])] ?? null,
        shelf: toShelf(cells[c.status], Boolean(date.value)),
        finished_at: date.value,
        rating: toRating(cells[c.rating]),
      });
    });
  });
  return { tables: tables.length, records, invalidDates };
}

/** Un même titre présent dans les deux tableaux = un seul livre, infos fusionnées. */
function mergeRecords(records) {
  const byTitle = new Map();
  for (const r of records) {
    const key = norm(r.title);
    const prev = byTitle.get(key);
    if (!prev) {
      byTitle.set(key, { ...r, lines: [r.line] });
      continue;
    }
    prev.lines.push(r.line);
    if (!prev.author && r.author) prev.author = r.author;
    if (!prev.lang && r.lang) prev.lang = r.lang;
    if (SHELF_RANK[r.shelf] > SHELF_RANK[prev.shelf]) prev.shelf = r.shelf;
    if (!prev.finished_at && r.finished_at) prev.finished_at = r.finished_at;
    if (!prev.rating && r.rating) prev.rating = r.rating;
    for (const g of r.genres) if (!prev.genres.includes(g) && prev.genres.length < 3) prev.genres.push(g);
  }
  return [...byTitle.values()];
}

/* ---------------------------------------------------------------- import */

async function main() {
  console.log(`Import de bibliothèque — mode ${MODE === "import" ? "IMPORT (écriture)" : "APERÇU (aucune écriture)"}\n`);

  // 1. Compte cible.
  let { data: profile } = await db.from("profiles").select("id").eq("username", PSEUDO).maybeSingle();
  if (!profile) {
    const { data } = await db.from("profiles").select("id").ilike("display_name", PSEUDO);
    if (data?.length === 1) profile = data[0];
  }
  if (!profile) {
    console.error("✗ Compte Bookclub introuvable pour ce pseudo. Vérifiez le pseudo exact dans Réglages.");
    process.exit(1);
  }
  console.log("✓ Compte Bookclub trouvé");

  // 2. Tableau.
  const { tables, records, invalidDates } = await readSheet();
  const books = mergeRecords(records);
  console.log(`✓ Tableau lu : ${tables} tableau(x), ${records.length} lignes, ${books.length} livres distincts après fusion\n`);

  // 3. Catalogue existant, en mémoire (quelques centaines de livres).
  const { data: catalogue } = await db.from("books").select("id, title, authors, source, source_id").limit(5000);
  const byNormTitle = new Map();
  const bySource = new Map();
  const index = (b) => {
    const k = norm(b.title);
    byNormTitle.set(k, [...(byNormTitle.get(k) ?? []), b]);
    if (b.source_id) bySource.set(`${b.source}:${b.source_id}`, b);
  };
  (catalogue ?? []).forEach(index);

  const stats = { existant: 0, openlibrary: 0, googlebooks: 0, sansAuteur: 0, introuvable: 0, couverture: 0, erreurs: [] };
  const shelves = { read: 0, reading: 0, wishlist: 0, abandoned: 0 };

  for (const r of books) {
    shelves[r.shelf] += 1;

    // a. Déjà au catalogue ?
    const same = byNormTitle.get(norm(r.title)) ?? [];
    let book = r.author ? same.find((b) => authorMatches(r.author, b.authors)) : same.length === 1 ? same[0] : null;
    let external = null;
    let genres = r.genres;

    if (book) stats.existant += 1;
    else if (r.author) {
      // b. Recherche externe, vérifiée titre + auteur.
      external = await findExternal(r.title, r.author);
      await sleep(250);
      if (external) {
        stats[external.source] += 1;
        if (external.cover_url) stats.couverture += 1;
        book = bySource.get(`${external.source}:${external.source_id}`) ?? null;
        // Le tableau dit seulement « Roman » : on précise avec les sujets de la source.
        if ((genres.length === 0 || (genres.length === 1 && genres[0] === "litterature")) && external.genres.length) {
          genres = [...new Set([...external.genres, ...genres])].slice(0, 3);
        }
      } else stats.introuvable += 1;
    } else stats.sansAuteur += 1;

    if (MODE !== "import") continue;

    try {
      // c. Création du livre si nécessaire.
      if (!book) {
        const row = external
          ? {
              source: external.source,
              source_id: external.source_id,
              title: r.title,
              authors: [r.author],
              cover_url: external.cover_url,
              published_year: external.published_year,
              page_count: external.page_count,
              language: r.lang,
              added_by: profile.id,
            }
          : {
              source: "manual",
              source_id: `manual:${r.title.toLowerCase()}|${r.author.toLowerCase()}`,
              title: r.title,
              authors: r.author ? [r.author] : [],
              cover_url: null,
              language: r.lang,
              added_by: profile.id,
            };
        const existing = bySource.get(`${row.source}:${row.source_id}`);
        if (existing) book = existing;
        else {
          const { data, error } = await db.from("books").insert(row).select("id, title, authors, source, source_id").single();
          if (error) throw new Error(error.message);
          book = data;
          index(book);
          const slugs = genres.length ? genres : ["litterature"];
          await db
            .from("book_genres")
            .upsert(slugs.map((genre_slug) => ({ book_id: book.id, genre_slug })), {
              onConflict: "book_id,genre_slug",
              ignoreDuplicates: true,
            });
        }
      }

      // d. Entrée de bibliothèque (le tableau fait foi pour l'étagère et la date).
      const { error: libError } = await db.from("library_items").upsert(
        {
          user_id: profile.id,
          book_id: book.id,
          shelf: r.shelf,
          finished_at: r.shelf === "read" ? r.finished_at : null,
        },
        { onConflict: "user_id,book_id" },
      );
      if (libError) throw new Error(libError.message);

      if (r.rating) {
        await db
          .from("ratings")
          .upsert({ user_id: profile.id, book_id: book.id, rating: r.rating }, { onConflict: "user_id,book_id" });
      }
    } catch (e) {
      stats.erreurs.push(`ligne ${r.lines.join("/")} (${e.message})`);
    }
  }

  console.log("Livres :");
  console.log(`  déjà au catalogue (réutilisés)                 : ${stats.existant}`);
  console.log(`  trouvés sur Open Library (titre + auteur ✓)    : ${stats.openlibrary}`);
  console.log(`  trouvés sur Google Books (titre + auteur ✓)    : ${stats.googlebooks}`);
  console.log(`    dont avec couverture                         : ${stats.couverture}`);
  console.log(`  sans auteur dans le tableau → fiche simple     : ${stats.sansAuteur}`);
  console.log(`  auteur présent mais introuvable → fiche simple : ${stats.introuvable}`);
  console.log("\nÉtagères :");
  console.log(`  Lu ${shelves.read} · En cours ${shelves.reading} · À lire ${shelves.wishlist} · Abandonné ${shelves.abandoned}`);
  console.log(`  dates de lecture reconnues : ${books.filter((b) => b.finished_at).length}`);
  console.log(`  notes reconnues            : ${books.filter((b) => b.rating).length}`);
  if (invalidDates.length) console.log(`  ⚠ dates illisibles, lignes : ${invalidDates.join(", ")}`);
  if (unmappedGenres.size) {
    console.log("\n⚠ Genres non reconnus (ignorés) :");
    for (const [g, n] of unmappedGenres) console.log(`  « ${g} » × ${n}`);
  }
  if (stats.erreurs.length) {
    console.log("\n✗ Erreurs :");
    stats.erreurs.forEach((e) => console.log(`  ${e}`));
  }
  console.log(MODE === "import" ? "\nImport terminé." : "\nAperçu terminé — rien n'a été écrit.");
  if (stats.erreurs.length) process.exit(1);
}

export { splitRows, splitCells, titleMatches, authorMatches, toShelf, toDate, toRating, toGenres, mergeRecords };

if (process.env.IMPORT_TEST !== "1") {
  main().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
}
