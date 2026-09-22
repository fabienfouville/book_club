#!/usr/bin/env node
/**
 * Bookclub — inspection de structure d'un Google Sheet.
 *
 *   node scripts/peek-sheet.mjs
 *
 * Sert UNIQUEMENT à découvrir la forme du tableau avant d'écrire l'import :
 * noms d'onglets, noms de colonnes, format des valeurs.
 *
 * CONFIDENTIALITÉ : le dépôt est public, donc les logs d'exécution le sont
 * aussi. Ce script n'affiche JAMAIS le contenu des lignes — seulement les
 * en-têtes, le nombre de lignes, et un extrait tronqué (12 caractères) par
 * colonne, le strict nécessaire pour reconnaître un format de date ou une
 * échelle de notes. L'identifiant du document vient d'un secret et n'est
 * jamais réaffiché.
 */

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
if (!SHEET_ID) {
  console.error("✗ Secret GOOGLE_SHEET_ID absent.");
  process.exit(1);
}

const EXTRAIT_MAX = 12;

/** Découpe une ligne CSV en tenant compte des guillemets. */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Lignes CSV complètes (une cellule peut contenir un retour à la ligne). */
function splitCsvRows(text) {
  const rows = [];
  let cur = "";
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    if (c === "\n" && !quoted) {
      rows.push(cur.replace(/\r$/, ""));
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim()) rows.push(cur.replace(/\r$/, ""));
  return rows;
}

function tronque(valeur) {
  const v = (valeur ?? "").trim();
  if (!v) return "(vide)";
  return v.length > EXTRAIT_MAX ? `${v.slice(0, EXTRAIT_MAX)}…` : v;
}

/** Noms des onglets, extraits de la page du document. */
async function listerOnglets() {
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const noms = new Set();
    for (const m of html.matchAll(/id="sheet-button-\d+"[^>]*>([^<]{1,60})</g)) {
      noms.add(m[1].trim());
    }
    return [...noms];
  } catch {
    return [];
  }
}

async function peek(url, etiquette) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    console.log(`\n### ${etiquette} : inaccessible (HTTP ${res.status})`);
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      console.log(
        "→ Le document n'est pas lisible sans connexion. Dans Google Sheets :",
        "\n  Partager → Accès général → « Tous les utilisateurs disposant du lien » → Lecteur.",
      );
    }
    return;
  }

  const rows = splitCsvRows(await res.text());
  if (rows.length === 0) {
    console.log(`\n### ${etiquette} : vide`);
    return;
  }

  const entetes = parseCsvLine(rows[0]);
  const lignes = rows.slice(1);

  console.log(`\n### ${etiquette}`);
  console.log(`Lignes de données : ${lignes.length}`);
  console.log(`Colonnes : ${entetes.length}\n`);

  entetes.forEach((entete, i) => {
    // Premier échantillon non vide de la colonne, tronqué.
    const exemples = [];
    for (const ligne of lignes) {
      const cellules = parseCsvLine(ligne);
      const v = (cellules[i] ?? "").trim();
      if (v && !exemples.includes(tronque(v))) exemples.push(tronque(v));
      if (exemples.length >= 3) break;
    }
    const remplies = lignes.filter((l) => (parseCsvLine(l)[i] ?? "").trim()).length;
    console.log(
      `  [${i}] « ${entete || "(sans titre)"} » — ${remplies}/${lignes.length} remplies` +
        (exemples.length ? ` — ex. : ${exemples.join(" | ")}` : ""),
    );
  });
}

async function main() {
  console.log("Inspection de structure (aucune donnée de lecture affichée).");

  const onglets = await listerOnglets();
  if (onglets.length) {
    console.log(`\nOnglets détectés : ${onglets.join(", ")}`);
  } else {
    console.log("\nOnglets : non détectés (on inspecte l'onglet par défaut).");
  }

  await peek(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`,
    "Onglet par défaut",
  );

  for (const nom of onglets.slice(0, 5)) {
    await peek(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nom)}`,
      `Onglet « ${nom} »`,
    );
  }
}

main();
