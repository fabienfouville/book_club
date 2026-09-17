"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { GenrePicker } from "@/components/auth/GenrePicker";
import { addManualBook } from "@/app/decouvrir/actions";

/** Ajout d'un livre absent des catalogues externes, saisi à la main. */
export function ManualBookForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    const title = String(formData.get("title") ?? "").trim();
    const authors = String(formData.get("authors") ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    const year = Number(formData.get("published_year"));
    const pages = Number(formData.get("page_count"));
    const genres = String(formData.get("genres") ?? "")
      .split(",")
      .filter(Boolean);

    startTransition(async () => {
      const result = await addManualBook({
        title,
        authors,
        published_year: Number.isFinite(year) && year > 0 ? year : null,
        page_count: Number.isFinite(pages) && pages > 0 ? pages : null,
        cover_url: String(formData.get("cover_url") ?? "").trim() || null,
        description: String(formData.get("description") ?? "").trim() || null,
        genre_slugs: genres,
      });
      // En cas de succès, l'action redirige : on n'arrive ici qu'en échec.
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <Field label="Titre" htmlFor="title">
        <Input id="title" name="title" required placeholder="Le titre du livre" />
      </Field>

      <Field label="Auteur·ices" htmlFor="authors" hint="Séparez plusieurs noms par une virgule.">
        <Input id="authors" name="authors" placeholder="Prénom Nom" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Année" htmlFor="published_year">
          <Input id="published_year" name="published_year" type="number" min={0} max={2100} />
        </Field>
        <Field label="Pages" htmlFor="page_count">
          <Input id="page_count" name="page_count" type="number" min={0} max={20000} />
        </Field>
      </div>

      <Field
        label="Couverture (URL, facultatif)"
        htmlFor="cover_url"
        hint="Collez l'adresse d'une image, sinon une couverture illustrée sera générée."
      >
        <Input id="cover_url" name="cover_url" type="url" placeholder="https://…" />
      </Field>

      <Field label="Résumé (facultatif)" htmlFor="description">
        <Textarea id="description" name="description" maxLength={2000} />
      </Field>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Genres</p>
        <GenrePicker />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Ajout…" : "Ajouter au catalogue"}
      </Button>
    </form>
  );
}

export default ManualBookForm;
