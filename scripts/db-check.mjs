#!/usr/bin/env node
/**
 * Bookclub — vérification de la base Supabase.
 *
 *   npm run db:check
 *
 * Se connecte avec les variables d'environnement (process.env, .env.local ou
 * .env) et contrôle que tout ce que les migrations sont censées créer existe
 * réellement : tables, vue, fonctions et catalogue de départ.
 *
 * Aucune dépendance en dehors de @supabase/supabase-js, déjà installé.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UUID_ZERO = "00000000-0000-0000-0000-000000000000";

/* ------------------------------------------------------------ environnement */

/** Lecture minimaliste d'un fichier .env (pas de dépendance dotenv). */
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const key = serviceKey || anonKey;

if (!url.startsWith("http") || key.length < 20) {
  console.error(
    [
      "",
      "Impossible de se connecter : configuration Supabase absente.",
      "",
      "Renseignez au minimum, dans .env.local :",
      "  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co",
      "  NEXT_PUBLIC_SUPABASE_ANON_KEY=...",
      "  SUPABASE_SERVICE_ROLE_KEY=...   (facultatif, mais plus fiable)",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ----------------------------------------------------------- ce qu'on attend */

const TABLES = [
  "profiles",
  "books",
  "genres",
  "book_genres",
  "library_items",
  "ratings",
  "reviews",
  "review_likes",
  "friendships",
  "communities",
  "community_members",
  "recommendations",
  "loan_requests",
  "notifications",
];

const VIEWS = ["book_stats"];

const FUNCTIONS = [
  { name: "are_friends", args: { a: UUID_ZERO, b: UUID_ZERO } },
  { name: "share_community", args: { a: UUID_ZERO, b: UUID_ZERO } },
  { name: "can_see_profile", args: { viewer: UUID_ZERO, target: UUID_ZERO } },
  { name: "is_community_member", args: { p_community: UUID_ZERO, p_user: UUID_ZERO } },
  { name: "book_owners_count", args: { p_book_id: UUID_ZERO } },
  { name: "book_readers_count", args: { p_book_id: UUID_ZERO } },
  { name: "current_jwt_role", args: {} },
  { name: "similar_books", args: { p_book_id: UUID_ZERO, p_limit: 1 } },
  { name: "recommend_for_user", args: { p_user: UUID_ZERO, p_limit: 1 } },
  { name: "join_community_by_code", args: { p_code: "__code-inexistant__" } },
];

/** Volumes attendus après 0004_seed.sql. */
const SEED = [
  { table: "genres", expected: 24, label: "genres" },
  { table: "books", expected: 44, label: "livres de départ", filter: (q) => q.eq("source", "seed") },
  { table: "book_genres", expected: 107, label: "rattachements livre/genre" },
];

/* ------------------------------------------------------------------ helpers */

const isMissingRelation = (error) =>
  !!error &&
  (error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table|does not exist|schema cache/i.test(error.message ?? ""));

const isMissingFunction = (error) =>
  !!error &&
  (error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|function .* does not exist/i.test(error.message ?? ""));

const results = [];
const record = (ok, label, detail = "") => {
  results.push({ ok, label, detail });
  const badge = ok ? "[ OK ]     " : "[ MANQUE ] ";
  console.log(`  ${badge}${label}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ vérifications */

async function checkRelations(names, kind) {
  for (const name of names) {
    const { count, error } = await supabase
      .from(name)
      .select("*", { count: "exact", head: true });
    if (isMissingRelation(error)) {
      record(false, `${kind} ${name}`, "introuvable");
    } else if (error) {
      // Une erreur de droits prouve que la relation existe bel et bien.
      record(true, `${kind} ${name}`, `présente (${error.code ?? "accès restreint"})`);
    } else {
      record(true, `${kind} ${name}`, `${count ?? 0} ligne(s) visible(s)`);
    }
  }
}

async function checkFunctions() {
  for (const fn of FUNCTIONS) {
    const { error } = await supabase.rpc(fn.name, fn.args);
    if (isMissingFunction(error)) {
      record(false, `fonction ${fn.name}()`, "introuvable");
    } else if (error) {
      // Refus attendu (« accès refusé », « Connexion requise »…) : elle existe.
      record(true, `fonction ${fn.name}()`, `présente (${error.message?.slice(0, 60) ?? ""})`);
    } else {
      record(true, `fonction ${fn.name}()`, "présente");
    }
  }
}

async function checkSeed() {
  for (const entry of SEED) {
    let query = supabase.from(entry.table).select("*", { count: "exact", head: true });
    if (entry.filter) query = entry.filter(query);
    const { count, error } = await query;
    if (error) {
      record(false, `données : ${entry.label}`, error.message?.slice(0, 80) ?? "erreur");
    } else if ((count ?? 0) < entry.expected) {
      record(
        false,
        `données : ${entry.label}`,
        `${count ?? 0}/${entry.expected} — 0004_seed.sql n'a pas été appliqué ?`
      );
    } else {
      record(true, `données : ${entry.label}`, `${count}/${entry.expected}`);
    }
  }
}

/* --------------------------------------------------------------------- main */

async function main() {
  console.log("");
  console.log("Bookclub — vérification de la base");
  console.log("----------------------------------");
  console.log(`  Projet : ${url}`);
  console.log(`  Clé    : ${serviceKey ? "service_role" : "anon (lecture publique seulement)"}`);
  console.log("");

  console.log("Tables");
  await checkRelations(TABLES, "table");
  console.log("");

  console.log("Vues");
  await checkRelations(VIEWS, "vue");
  console.log("");

  console.log("Fonctions");
  await checkFunctions();
  console.log("");

  console.log("Catalogue de départ");
  await checkSeed();
  console.log("");

  const failures = results.filter((r) => !r.ok);
  console.log("----------------------------------");
  if (failures.length === 0) {
    console.log(`Tout est en place : ${results.length} contrôles réussis.`);
    console.log("");
    return 0;
  }

  console.log(`${failures.length} élément(s) manquant(s) sur ${results.length} contrôles :`);
  for (const f of failures) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`);
  console.log("");
  console.log("Marche à suivre : appliquer les migrations de supabase/migrations dans");
  console.log("l'ordre (0001, 0002, 0003, 0004) depuis l'éditeur SQL de Supabase.");
  console.log("Voir docs/BASE_DE_DONNEES.md.");
  console.log("");
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("");
    console.error("La vérification a échoué :", err?.message ?? err);
    console.error("");
    process.exit(1);
  });
