/**
 * Résumé du livre. Au-delà de quelques lignes, il se replie derrière un
 * « Lire la suite » — en `<details>`, donc sans une ligne de JavaScript.
 */
const SEUIL = 420;

export function BookSynopsis({ text }: { text: string }) {
  const clean = text.trim();
  if (!clean) return null;

  if (clean.length <= SEUIL) {
    return <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{clean}</p>;
  }

  return (
    <details className="group">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="block whitespace-pre-line text-sm leading-relaxed text-ink-soft group-open:hidden">
          {`${clean.slice(0, SEUIL).trimEnd()}…`}
        </span>
        <span className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary">
          <span className="group-open:hidden">Lire la suite</span>
          <span className="hidden group-open:inline">Replier le résumé</span>
        </span>
      </summary>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{clean}</p>
    </details>
  );
}
