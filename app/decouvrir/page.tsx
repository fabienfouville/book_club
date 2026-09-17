import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Chip, ChipLink, ChipRow } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { CatalogueGrid } from "@/components/books/BookRails";
import { ExternalSearchPanel } from "@/components/books/ExternalSearchPanel";
import { SortSelect } from "@/components/books/SortSelect";
import { GENRES } from "@/lib/data/genres";
import {
  OWNERSHIP_LABELS,
  OWNERSHIPS,
  listBooks,
  parseOwnership,
  parseSort,
} from "@/lib/data/catalogue";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Découvrir",
  description: "Cherchez, filtrez par genre et découvrez de nouveaux livres.",
};

const PAGE_SIZE = 24;

function buildHref(
  params: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
) {
  const next = new URLSearchParams();
  const merged = { ...params, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/decouvrir?${qs}` : "/decouvrir";
}

export default async function DecouvrirPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const activeGenres = (sp.genres ?? "").split(",").filter(Boolean);
  const sort = parseSort(sp.tri);
  const ownership = parseOwnership(sp.appartenance);
  const offset = Math.max(Number(sp.offset ?? 0) || 0, 0);

  const user = await getCurrentUser();

  const { items, hasMore, demo } = await listBooks({
    q,
    genres: activeGenres,
    sort,
    ownership,
    userId: user?.id ?? null,
    limit: PAGE_SIZE,
    offset,
  });

  const baseParams = {
    q: q || undefined,
    genres: activeGenres.length ? activeGenres.join(",") : undefined,
    tri: sort === "populaire" ? undefined : sort,
    appartenance: ownership === "tous" ? undefined : ownership,
  };

  function toggleGenreHref(slug: string) {
    const next = activeGenres.includes(slug)
      ? activeGenres.filter((s) => s !== slug)
      : [...activeGenres, slug];
    return buildHref(baseParams, {
      genres: next.length ? next.join(",") : undefined,
      offset: undefined,
    });
  }

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Découvrir</h1>
        <ButtonLink href="/decouvrir/ajouter" variant="secondary" size="sm">
          Ajouter un livre
        </ButtonLink>
      </div>

      <form action="/decouvrir" className="flex gap-2">
        {activeGenres.length ? (
          <input type="hidden" name="genres" value={activeGenres.join(",")} />
        ) : null}
        {ownership !== "tous" ? (
          <input type="hidden" name="appartenance" value={ownership} />
        ) : null}
        {sort !== "populaire" ? <input type="hidden" name="tri" value={sort} /> : null}
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Titre, autrice, auteur…"
          aria-label="Rechercher un livre"
          className="flex-1"
        />
        <button
          type="submit"
          className="min-h-[46px] rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink"
        >
          Chercher
        </button>
      </form>

      <ChipRow label="Filtrer par genre">
        {GENRES.map((genre) => (
          <ChipLink
            key={genre.slug}
            href={toggleGenreHref(genre.slug)}
            active={activeGenres.includes(genre.slug)}
          >
            <span aria-hidden>{genre.emoji}</span> {genre.label}
          </ChipLink>
        ))}
      </ChipRow>

      <div className="flex flex-wrap items-center gap-2">
        <ChipRow label="Filtrer par appartenance à ma bibliothèque">
          {OWNERSHIPS.map((value) => (
            <ChipLink
              key={value}
              active={ownership === value}
              href={buildHref(baseParams, {
                appartenance: value === "tous" ? undefined : value,
                offset: undefined,
              })}
            >
              {OWNERSHIP_LABELS[value]}
            </ChipLink>
          ))}
        </ChipRow>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-faint">
          {items.length === 0
            ? "Aucun livre"
            : `${items.length}${hasMore ? "+" : ""} livre${items.length > 1 ? "s" : ""}`}
        </p>
        <form action="/decouvrir" className="flex items-center gap-2">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {activeGenres.length ? (
            <input type="hidden" name="genres" value={activeGenres.join(",")} />
          ) : null}
          {ownership !== "tous" ? (
            <input type="hidden" name="appartenance" value={ownership} />
          ) : null}
          <label className="sr-only" htmlFor="tri">
            Trier
          </label>
          <SortSelect defaultValue={sort} />
        </form>
      </div>

      {demo ? (
        <p className="rounded-xl border border-border-strong bg-primary-soft px-3 py-2 text-xs text-ink-soft">
          Mode démonstration : catalogue local, la recherche externe et
          l&apos;import ne sont pas disponibles tant que Supabase n&apos;est pas connecté.
        </p>
      ) : null}

      {items.length > 0 ? (
        <CatalogueGrid items={items} />
      ) : !q ? (
        <EmptyState
          emoji="🔭"
          title="Rien à afficher ici"
          description="Essayez d'autres genres, ou passez le filtre d'appartenance à « Tous »."
          actionLabel="Réinitialiser les filtres"
          actionHref="/decouvrir"
        />
      ) : null}

      {q && !demo ? (
        <div className="space-y-2 pt-2">
          {items.length > 0 ? (
            <p className="text-sm font-semibold text-ink">
              D&apos;autres résultats pour «&nbsp;{q}&nbsp;» ?
            </p>
          ) : null}
          <ExternalSearchPanel query={q} />
        </div>
      ) : null}

      {items.length > 0 && hasMore ? (
        <div className="flex justify-center pt-2">
          <Link
            href={buildHref(baseParams, { offset: String(offset + PAGE_SIZE) })}
            className="inline-flex min-h-[44px] items-center rounded-full border border-border-strong bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-surface-muted"
          >
            Voir plus de livres
          </Link>
        </div>
      ) : null}
    </div>
  );
}
