#!/usr/bin/env node
/**
 * Bookclub — resynchronise les couvertures du catalogue de départ.
 *
 *   node scripts/resync-seed-covers.mjs
 *
 * Pourquoi ce script : les couvertures posées à l'import (devinées à partir
 * d'un ISBN) tombaient parfois sur la couverture d'une AUTRE édition. Ici,
 * on cherche chaque livre par TITRE + AUTEUR — la même recherche que celle
 * utilisée par la page /decouvrir quand un membre importe un livre à la
 * main, qui donne le bon résultat. On ne touche qu'aux couvertures, jamais
 * au reste de la fiche.
 *
 * Nécessite un accès réseau à Open Library / Google Books (aucune clé) et
 * les variables NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans
 * .env.local ou l'environnement. Se lance en local, jamais depuis un
 * environnement sans accès internet.
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  console.error(
    "✗ Il manque NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY (dans .env.local).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const catalogue = JSON.parse(
  readFileSync(resolve(ROOT, "lib/data/catalogue.json"), "utf8"),
);

const TIMEOUT_MS = 8000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Titre : correct si le titre normalisé contient (ou est contenu dans)
 * celui qu'on cherche — filtre simple mais efficace ici. */
function titleMatches(wanted, got) {
  const a = normalize(wanted);
  const b = normalize(got);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a) || a.slice(0, 12) === b.slice(0, 12);
}

function lastWord(s) {
  const parts = normalize(s).split(" ").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Auteur : substring dans un sens ou l'autre, ou même nom de famille — les
 * sources orthographient parfois « Nom, Prénom » ou l'inverse. Un titre
 * générique (« Eldorado », « L'Alchimiste »…) existe souvent chez plusieurs
 * auteurs : sans cette vérification, on récupère la couverture d'un AUTRE
 * livre. C'est exactement le bug qu'on corrige ici — ne jamais la retirer. */
function authorMatches(wanted, gotAuthors) {
  if (!wanted) return true;
  const w = normalize(wanted);
  const wLast = lastWord(wanted);
  const tokens = (s) => normalize(s).split(" ").filter((t) => t.length > 2);
  const wTokens = tokens(wanted);
  return (gotAuthors ?? []).some((g) => {
    const ng = normalize(g);
    if (!ng || !w) return false;
    if (ng.includes(w) || w.includes(ng)) return true;
    // Nom de famille retrouvé dans l'autre nom, dans les deux sens : tolère
    // « Coelho, Paulo » face à « Paulo Coelho », jamais un simple prénom commun.
    const gLast = lastWord(g);
    return (wLast.length > 2 && tokens(g).includes(wLast)) || (gLast.length > 2 && wTokens.includes(gLast));
  });
}

function isPlausibleMatch(wantedTitle, wantedAuthor, got) {
  return titleMatches(wantedTitle, got.title) && authorMatches(wantedAuthor, got.authors);
}

async function searchOpenLibrary(query) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,cover_i,cover_edition_key&limit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs ?? [])
    .filter((d) => d.cover_i)
    .map((d) => ({
      title: d.title ?? "",
      authors: d.author_name ?? [],
      cover_url: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,
    }));
}

async function searchGoogleBooks(query) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? [])
    .map((it) => {
      const img = it.volumeInfo?.imageLinks;
      const cover = img?.thumbnail || img?.smallThumbnail;
      return cover
        ? {
            title: it.volumeInfo?.title ?? "",
            authors: it.volumeInfo?.authors ?? [],
            cover_url: cover.replace(/^http:/, "https:"),
          }
        : null;
    })
    .filter(Boolean);
}

async function findCover(title, author) {
  const query = `${title} ${author ?? ""}`.trim();
  try {
    const openLib = await searchOpenLibrary(query);
    const hit = openLib.find((r) => isPlausibleMatch(title, author, r));
    if (hit) return hit.cover_url;
  } catch {
    // on retombe sur Google Books
  }
  try {
    const google = await searchGoogleBooks(query);
    const hit = google.find((r) => isPlausibleMatch(title, author, r));
    if (hit) return hit.cover_url;
  } catch {
    // aucune source n'a répondu pour ce livre
  }
  return null; // mieux vaut aucune couverture qu'une couverture fausse
}

async function main() {
  console.log(`Resynchronisation de ${catalogue.length} couvertures…\n`);
  let updated = 0;
  let unchanged = 0;

  for (const book of catalogue) {
    const author = book.authors?.[0] ?? "";
    process.stdout.write(`• ${book.title} — ${author} … `);
    const coverUrl = await findCover(book.title, author);

    // Sans correspondance vérifiée (titre + auteur), on efface toute
    // couverture existante plutôt que de la laisser telle quelle : une
    // couverture jamais confirmée par ce contrôle peut très bien être une
    // erreur laissée par une exécution précédente (moins stricte). Mieux
    // vaut la couverture stylisée générée par l'appli qu'une image fausse.
    const { error } = await supabase
      .from("books")
      .update({ cover_url: coverUrl })
      .eq("id", book.id)
      .eq("source", "seed");

    if (error) {
      console.log(`échec (${error.message})`);
      unchanged += 1;
    } else if (!coverUrl) {
      console.log("aucune couverture fiable, effacée par précaution");
      updated += 1;
    } else {
      console.log("ok");
      updated += 1;
    }

    await sleep(250); // reste courtois envers les API gratuites
  }

  console.log(`\nTerminé : ${updated} couvertures mises à jour, ${unchanged} inchangées.`);
}

main();
