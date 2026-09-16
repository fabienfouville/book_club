/**
 * Dates en français, sans dépendance.
 * `Intl.RelativeTimeFormat` existe, mais on veut nos propres seuils
 * (« hier », « la semaine dernière ») et un vocabulaire homogène.
 */

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;
const SEMAINE = 7 * JOUR;
const MOIS = 30 * JOUR;
const AN = 365 * JOUR;

function pluriel(n: number, singulier: string, plurielMot = `${singulier}s`) {
  return `${n} ${n > 1 ? plurielMot : singulier}`;
}

/** « il y a 3 jours », « hier », « à l'instant ». */
export function relativeDateFr(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const ms = now.getTime() - date.getTime();
  if (Number.isNaN(ms)) return "";
  // Une date future (horloges désynchronisées) est ramenée au présent.
  if (ms < MINUTE) return "à l'instant";
  if (ms < HEURE) return `il y a ${pluriel(Math.floor(ms / MINUTE), "minute")}`;
  if (ms < JOUR) return `il y a ${pluriel(Math.floor(ms / HEURE), "heure")}`;
  if (ms < 2 * JOUR) return "hier";
  if (ms < SEMAINE) return `il y a ${pluriel(Math.floor(ms / JOUR), "jour")}`;
  if (ms < MOIS) return `il y a ${pluriel(Math.floor(ms / SEMAINE), "semaine")}`;
  if (ms < AN) return `il y a ${pluriel(Math.floor(ms / MOIS), "mois", "mois")}`;
  return `il y a ${pluriel(Math.floor(ms / AN), "an")}`;
}

/** « 14 mars 2024 » — en info-bulle sous la date relative. */
export function fullDateFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const MOIS_COURTS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** « mars » — libellé d'axe pour le rythme de lecture. */
export function monthShortFr(month: number): string {
  return MOIS_COURTS[month] ?? "";
}

/** Clé de regroupement mensuel, stable et triable : « 2024-03 ». */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
