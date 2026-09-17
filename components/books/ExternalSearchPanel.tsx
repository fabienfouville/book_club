"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BookCover } from "./BookCover";
import { Sheet } from "@/components/social/Sheet";
import { GenrePicker } from "@/components/auth/GenrePicker";
import { importExternalBook } from "@/app/decouvrir/actions";
import type { ExternalBook } from "@/lib/books/normalize";

/**
 * Repli quand le catalogue local ne trouve rien : interroge Open Library
 * (puis Google Books) et permet d'importer un résultat en un clic.
 */
export function ExternalSearchPanel({ query }: { query: string }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "chargement" }
    | { status: "resultats"; items: ExternalBook[]; source: string }
    | { status: "erreur"; message: string }
  >({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // Livre en cours de confirmation de genre, et genres choisis pour lui.
  const [picking, setPicking] = useState<ExternalBook | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  function lancer() {
    setState({ status: "chargement" });
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/livres/recherche?q=${encodeURIComponent(query)}`,
        );
        const data = (await res.json()) as {
          items: ExternalBook[];
          source: string;
        };
        setState({ status: "resultats", items: data.items, source: data.source });
      } catch {
        setState({
          status: "erreur",
          message: "La recherche externe n'a pas répondu. Réessayez.",
        });
      }
    });
  }

  function ouvrirChoixGenre(book: ExternalBook) {
    setImportError(null);
    setPicked(book.genre_slugs ?? []);
    setPicking(book);
  }

  function confirmerImport() {
    if (!picking) return;
    const book = picking;
    setImportError(null);
    setImportingKey(book.source_id);
    setPicking(null);
    startTransition(async () => {
      const result = await importExternalBook(book, picked);
      // En cas de succès, `importExternalBook` redirige : on n'arrive ici
      // que si l'import a échoué.
      if (result && !result.ok) setImportError(result.error);
      setImportingKey(null);
    });
  }

  if (state.status === "idle") {
    return (
      <div className="bc-card flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-ink-soft">
          Aucun résultat dans le catalogue de Bookclub pour «&nbsp;{query}&nbsp;».
        </p>
        <Button type="button" onClick={lancer} disabled={pending}>
          Chercher dans Open Library
        </Button>
      </div>
    );
  }

  if (state.status === "chargement") {
    return (
      <p className="py-6 text-center text-sm text-ink-soft">
        Recherche en cours…
      </p>
    );
  }

  if (state.status === "erreur") {
    return (
      <div className="bc-card space-y-3 p-6 text-center">
        <p className="text-sm text-danger">{state.message}</p>
        <Button type="button" variant="secondary" onClick={lancer}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="bc-card space-y-3 p-6 text-center">
        <p className="text-sm text-ink-soft">
          Ni le catalogue de Bookclub ni les sources externes n&apos;ont rien
          trouvé pour «&nbsp;{query}&nbsp;».
        </p>
        <ButtonLink href="/decouvrir/ajouter" variant="secondary">
          Ajouter ce livre à la main
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {importError ? (
        <p role="alert" className="text-sm text-danger">
          {importError}
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {state.items.map((book) => (
          <li key={book.source_id} className="space-y-1.5">
            <BookCover title={book.title} authors={book.authors} url={book.cover_url} />
            <p className="text-xs font-semibold leading-snug line-clamp-2-safe">
              {book.title}
            </p>
            <p className="truncate text-[11px] text-ink-soft">
              {book.authors[0] ?? "Auteur inconnu"}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() => ouvrirChoixGenre(book)}
            >
              {importingKey === book.source_id ? "Ajout…" : "Ajouter au catalogue"}
            </Button>
          </li>
        ))}
      </ul>

      <Sheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        title="Dans quel genre le classer ?"
        description={picking?.title}
      >
        {picking ? (
          <div className="space-y-4">
            <GenrePicker defaultValue={picked} onChangeValue={setPicked} />
            <Button type="button" onClick={confirmerImport} className="w-full">
              Ajouter au catalogue
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

export default ExternalSearchPanel;
