"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Field";
import { IconSearch } from "@/components/ui/Icons";
import { libraryHref } from "@/lib/library/url";
import type { LibraryFilters } from "@/lib/library/queries";

/**
 * Recherche dans sa propre bibliothèque. Le texte est poussé dans l'URL après
 * une courte pause, en `replace` : on ne remplit pas l'historique à chaque
 * lettre, mais l'adresse reste partageable.
 */
export function LibrarySearch({ filters }: { filters: LibraryFilters }) {
  const router = useRouter();
  const [value, setValue] = useState(filters.q);
  const dernier = useRef(filters.q);

  // L'URL fait foi : un clic sur « Tout effacer » vide aussi le champ.
  useEffect(() => {
    if (filters.q !== dernier.current) {
      dernier.current = filters.q;
      setValue(filters.q);
    }
  }, [filters.q]);

  useEffect(() => {
    if (value === dernier.current) return;
    const id = setTimeout(() => {
      dernier.current = value;
      router.replace(libraryHref(filters, { q: value }), { scroll: false });
    }, 280);
    return () => clearTimeout(id);
  }, [value, filters, router]);

  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="relative"
    >
      <label htmlFor="biblio-recherche" className="sr-only">
        Rechercher dans ma bibliothèque
      </label>
      <IconSearch
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint"
      />
      <Input
        id="biblio-recherche"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Un titre, un auteur…"
        className="pl-11"
        autoComplete="off"
      />
    </form>
  );
}

export default LibrarySearch;
