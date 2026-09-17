"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importBook, createManualBook, type ManualBookInput } from "@/lib/books/import";
import type { ExternalBook } from "@/lib/books/normalize";

/**
 * Importe un résultat de recherche externe (Open Library / Google Books)
 * dans le catalogue partagé, puis va directement à sa fiche.
 */
export async function importExternalBook(external: ExternalBook, genres?: string[]) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  // Les sujets Open Library/Google Books se mappent mal sur nos genres :
  // on donne toujours la main au membre plutôt que de deviner en silence.
  const withGenres: ExternalBook =
    genres && genres.length ? { ...external, genre_slugs: genres } : external;

  const result = await importBook(withGenres, data.user?.id ?? null);
  if (!result.ok || !result.id) {
    return { ok: false as const, error: result.message ?? "L'import a échoué." };
  }

  revalidatePath("/decouvrir");
  redirect(`/livre/${result.id}`);
}

/** Ajout manuel, pour les livres qu'aucun catalogue externe ne référence. */
export async function addManualBook(input: ManualBookInput) {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false as const, error: "Connectez Supabase pour ajouter un livre." };
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { ok: false as const, error: "Connectez-vous pour ajouter un livre." };
  }

  const title = input.title?.trim();
  if (!title) return { ok: false as const, error: "Le titre est obligatoire." };

  const result = await createManualBook(
    {
      title,
      authors: input.authors ?? [],
      published_year: input.published_year ?? null,
      page_count: input.page_count ?? null,
      cover_url: input.cover_url ?? null,
      description: input.description ?? null,
      genre_slugs: input.genre_slugs ?? [],
    },
    data.user.id,
  );

  if (!result.ok || !result.id) {
    return { ok: false as const, error: result.message ?? "L'ajout a échoué." };
  }

  revalidatePath("/decouvrir");
  redirect(`/livre/${result.id}`);
}
