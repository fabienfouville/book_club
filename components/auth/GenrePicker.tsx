"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { GENRES } from "@/lib/data/genres";

/**
 * Sélection des genres préférés en puces. La valeur part dans un champ caché
 * sous forme de liste de slugs séparés par des virgules.
 */
export function GenrePicker({
  name = "genres",
  defaultValue = [],
  onChangeValue,
}: {
  name?: string;
  defaultValue?: string[];
  onChangeValue?: (slugs: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);

  function toggle(slug: string) {
    setSelected((current) => {
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      onChangeValue?.(next);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selected.join(",")} />
      <div role="group" aria-label="Genres préférés" className="flex flex-wrap gap-2">
        {GENRES.map((genre) => {
          const active = selected.includes(genre.slug);
          return (
            <Chip
              key={genre.slug}
              active={active}
              onClick={() => toggle(genre.slug)}
              title={active ? `Retirer ${genre.label}` : `Ajouter ${genre.label}`}
            >
              <span aria-hidden>{genre.emoji}</span>
              {genre.label}
            </Chip>
          );
        })}
      </div>
      <p aria-live="polite" className="text-xs text-ink-faint">
        {selected.length === 0
          ? "Aucun genre choisi pour l'instant."
          : `${selected.length} genre${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}.`}
      </p>
    </div>
  );
}
