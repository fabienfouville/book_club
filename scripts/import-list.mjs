#!/usr/bin/env node
/**
 * Bookclub — ajoute une liste de livres vérifiée à la bibliothèque d'un compte.
 *
 *   IMPORT_FILE=scripts/data/liste-etagere.json BOOKCLUB_PSEUDO=xxx \
 *   IMPORT_MODE=apercu|import node scripts/import-list.mjs
 *
 * Le fichier est un tableau de { t: titre, a: auteur, g: genre, cover?: url }.
 * Les couvertures ont été validées une à une par la propriétaire des livres :
 * on les reprend telles quelles, sans nouvelle recherche. Un livre sans
 * `cover` garde la couverture générée par le site.
 *
 * Chaque livre est marqué « possédé », sur l'étagère IMPORT_SHELF (« read »
 * par défaut). Une entrée de bibliothèque déjà présente n'est jamais
 * modifiée : ses notes, dates et étagère restent intactes. Un livre déjà au
 * catalogue (même titre et même auteur) est réutilisé tel quel.
 *
 * Le dépôt est public : les logs n'affichent ni titre ni auteur.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PSEUDO = (process.env.BOOKCLUB_PSEUDO ?? "").trim().replace(/^@/, "");
const FILE = process.env.IMPORT_FILE;
const MODE = process.env.IMPORT_MODE === "import" ? "import" : "apercu";
const SHELF = ["read", "reading", "wishlist", "abandoned"].includes(process.env.IMPORT_SHELF)
  ? process.env.IMPORT_SHELF
  : "read";

if (!URL_SB || !KEY || !PSEUDO || !FILE) {
  console.error("✗ Il manque NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOKCLUB_PSEUDO ou IMPORT_FILE.");
  process.exit(1);
}
const db = createClient(URL_SB, KEY, { auth: { persistSession: false } });

const norm = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const lastWord = (s) => norm(s).split(" ").filter(Boolean).pop() ?? "";

/** Même auteur : nom complet inclus, ou même nom de famille. */
function sameAuthor(wanted, authors) {
  if (!wanted) return (authors ?? []).length === 0;
  const w = norm(wanted);
  const wl = lastWord(wanted);
  return (authors ?? []).some((a) => {
    const n = norm(a);
    return n.includes(w) || w.includes(n) || (wl.length > 2 && n.split(" ").includes(wl));
  });
}

async function main() {
  console.log(`Ajout d'une liste — mode ${MODE === "import" ? "IMPORT (écriture)" : "APERÇU (aucune écriture)"}\n`);
  const list = JSON.parse(readFileSync(FILE, "utf8"));

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

  const { data: catalogue, error: catError } = await db.from("books").select("id, title, authors").limit(10000);
  if (catError) throw new Error(catError.message);
  const byTitle = new Map();
  for (const b of catalogue) byTitle.set(norm(b.title), [...(byTitle.get(norm(b.title)) ?? []), b]);

  const { data: mine } = await db.from("library_items").select("book_id").eq("user_id", profile.id);
  const already = new Set((mine ?? []).map((r) => r.book_id));

  const stats = { reutilises: 0, crees: 0, couvertures: 0, dejaEnBibliotheque: 0, ajoutes: 0, erreurs: [] };

  for (const [i, r] of list.entries()) {
    let book = (byTitle.get(norm(r.t)) ?? []).find((b) => sameAuthor(r.a, b.authors));
    if (book) stats.reutilises += 1;
    else {
      stats.crees += 1;
      if (r.cover) stats.couvertures += 1;
    }
    if (book && already.has(book.id)) {
      stats.dejaEnBibliotheque += 1;
      continue;
    }
    if (MODE !== "import") {
      stats.ajoutes += 1;
      continue;
    }

    try {
      if (!book) {
        const { data, error } = await db
          .from("books")
          .insert({
            source: "manual",
            source_id: `manual:${r.t.toLowerCase()}|${(r.a ?? "").toLowerCase()}`,
            title: r.t,
            authors: r.a ? [r.a] : [],
            cover_url: r.cover ?? null,
            added_by: profile.id,
          })
          .select("id, title, authors")
          .single();
        if (error) throw new Error(error.message);
        book = data;
        byTitle.set(norm(book.title), [...(byTitle.get(norm(book.title)) ?? []), book]);
        const { error: gError } = await db
          .from("book_genres")
          .upsert({ book_id: book.id, genre_slug: r.g || "litterature" }, { onConflict: "book_id,genre_slug", ignoreDuplicates: true });
        if (gError) throw new Error(gError.message);
      }

      // ignoreDuplicates : une entrée existante (étagère, date, note) n'est jamais écrasée.
      const { error: libError } = await db
        .from("library_items")
        .upsert(
          { user_id: profile.id, book_id: book.id, shelf: SHELF, is_owned: true },
          { onConflict: "user_id,book_id", ignoreDuplicates: true },
        );
      if (libError) throw new Error(libError.message);
      already.add(book.id);
      stats.ajoutes += 1;
    } catch (e) {
      stats.erreurs.push(`entrée ${i + 1} (${e.message})`);
    }
  }

  console.log(`\n${list.length} livres dans la liste`);
  console.log(`  déjà au catalogue (réutilisés)      : ${stats.reutilises}`);
  console.log(`  nouvelles fiches                    : ${stats.crees} (dont ${stats.couvertures} avec couverture validée)`);
  console.log(`  déjà dans cette bibliothèque        : ${stats.dejaEnBibliotheque} (laissés tels quels)`);
  console.log(`  ${MODE === "import" ? "ajoutés" : "à ajouter"} comme possédés (${SHELF}) : ${stats.ajoutes}`);
  if (stats.erreurs.length) {
    console.log("\n✗ Erreurs :");
    stats.erreurs.forEach((e) => console.log(`  ${e}`));
  }
  console.log(MODE === "import" ? "\nImport terminé." : "\nAperçu terminé — rien n'a été écrit.");
  if (stats.erreurs.length) process.exit(1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
