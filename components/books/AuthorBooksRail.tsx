"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/social/Sheet";
import { GenrePicker } from "@/components/auth/GenrePicker";
import { BookCover } from "./BookCover";
import { BookRail } from "./BookCard";
import { importExternalBook } from "@/app/decouvrir/actions";
import type { ExternalBook } from "@/lib/books/normalize";

function normTitle(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Autres livres de l'auteur trouvés directement sur Open Library — requête
 * automatique dès l'affichage, aucun clic requis. Les titres déjà présents
 * dans le catalogue (`knownTitles`) sont exclus pour ne pas se répéter.
 */
export function AuthorBooksRail({
  author,
  knownTitles,
}: {
  author: string;
  knownTitles: string[];
}) {
  const [items, setItems] = useState<ExternalBook[] | null>(null); // null = en cours
  const [picking, setPicking] = useState<ExternalBook | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    const known = new Set(knownTitles.map(normTitle));
    fetch(`/api/livres/recherche?q=${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((data: { items?: ExternalBook[] }) => {
        if (!alive) return;
        const filtered = (data.items ?? []).filter(
          (b) =>
            b.authors.some((a) => normTitle(a) === normTitle(author)) &&
            !known.has(normTitle(b.title)),
        );

        // Open Library catalogue souvent chaque traduction comme une œuvre
        // à part : sans ça, « Dune » ressortirait une fois par langue. On ne
        // garde qu'un exemplaire par titre (de préférence avec couverture).
        const byTitle = new Map<string, ExternalBook>();
        for (const book of filtered) {
          const key = normTitle(book.title);
          const existing = byTitle.get(key);
          if (!existing || (!existing.cover_url && book.cover_url)) {
            byTitle.set(key, book);
          }
        }
        setItems([...byTitle.values()]);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  function ouvrirChoixGenre(book: ExternalBook) {
    setError(null);
    setPicked(book.genre_slugs ?? []);
    setPicking(book);
    setEnriching(true);
    const params = new URLSearchParams({
      source: book.source,
      source_id: book.source_id,
      title: book.title,
      author: book.authors[0] ?? "",
    });
    fetch(`/api/livres/genres?${params}`)
      .then((res) => res.json())
      .then((data: { genres?: string[] }) => {
        if (data.genres?.length) {
          setPicked((c) => [...new Set([...c, ...data.genres!])].slice(0, 4));
        }
      })
      .catch(() => {})
      .finally(() => setEnriching(false));
  }

  function confirmerImport() {
    if (!picking) return;
    const book = picking;
    setImportingKey(book.source_id);
    setPicking(null);
    startTransition(async () => {
      const result = await importExternalBook(book, picked);
      if (result && !result.ok) setError(result.error);
      setImportingKey(null);
    });
  }

  if (items === null) {
    return <p className="text-sm text-ink-faint">Recherche sur Open Library…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Rien d&apos;autre trouvé sur Open Library pour {author}.
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <BookRail label={`Autres livres de ${author} sur Open Library`}>
        {items.map((book) => (
          <div key={book.source_id} className="w-[132px] shrink-0 space-y-1.5">
            <BookCover title={book.title} authors={book.authors} url={book.cover_url} />
            <p className="text-xs font-semibold leading-snug line-clamp-2-safe">
              {book.title}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() => ouvrirChoixGenre(book)}
            >
              {importingKey === book.source_id ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        ))}
      </BookRail>

      <Sheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        title="Dans quel genre le classer ?"
        description={picking?.title}
      >
        {picking ? (
          <div className="space-y-4">
            {enriching ? (
              <p className="text-xs text-ink-faint">Recherche du genre en cours…</p>
            ) : null}
            <GenrePicker key={picked.join(",")} defaultValue={picked} onChangeValue={setPicked} />
            <Button type="button" onClick={confirmerImport} className="w-full">
              Ajouter au catalogue
            </Button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

export default AuthorBooksRail;
