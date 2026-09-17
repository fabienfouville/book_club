/** Formatage des dates et libellés partagés par le lot social. */

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const SHORT_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return DATE_FORMAT.format(date);
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return SHORT_FORMAT.format(date);
}

/** « il y a 3 jours » — sans dépendance, calculé à la volée. */
export function formatRelative(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return days <= 1 ? "hier" : `il y a ${days} jours`;
  return formatShortDate(value) ?? "";
}

/** Valeur `min` d'un champ date : on n'emprunte pas dans le passé. */
export function todayAsInputValue() {
  return new Date().toISOString().slice(0, 10);
}
