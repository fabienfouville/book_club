import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENRE_BY_SLUG } from "@/lib/data/genres";
import { DEFAULT_GENRE, type ExternalBook } from "./normalize";

export interface ImportResult {
  ok: boolean;
  /** Identifiant du livre dans `books`, présent dès que `ok` est vrai. */
  id?: string;
  /** Vrai si le livre a été créé, faux s'il existait déjà. */
  created?: boolean;
  message?: string;
}

/**
 * Le catalogue `books` est partagé : les politiques RLS empêchent un membre
 * d'y écrire librement. On privilégie donc le client admin quand la clé de
 * service est disponible, et on retombe sur le client utilisateur sinon.
 */
async function getWriteClient(): Promise<SupabaseClient | null> {
  const admin = createAdminClient();
  if (admin) return admin;
  return createClient();
}

function cleanGenres(slugs: string[]): string[] {
  const kept = slugs.filter((slug) => GENRE_BY_SLUG.has(slug));
  return kept.length ? [...new Set(kept)].slice(0, 4) : [DEFAULT_GENRE];
}

/** Crée les liens `book_genres` manquants. Un échec ici n'annule pas l'import. */
async function linkGenres(db: SupabaseClient, bookId: string, slugs: string[]) {
  const rows = cleanGenres(slugs).map((genre_slug) => ({ book_id: bookId, genre_slug }));
  if (!rows.length) return;
  const { error } = await db
    .from("book_genres")
    .upsert(rows, { onConflict: "book_id,genre_slug", ignoreDuplicates: true });
  if (error) console.warn("[books] liaison des genres impossible :", error.message);
}

/** Cherche un livre déjà présent : d'abord `(source, source_id)`, puis `isbn13`. */
async function findExisting(
  db: SupabaseClient,
  external: Pick<ExternalBook, "source" | "source_id" | "isbn13">,
): Promise<string | null> {
  if (external.source_id) {
    const { data } = await db
      .from("books")
      .select("id")
      .eq("source", external.source)
      .eq("source_id", external.source_id)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }
  if (external.isbn13) {
    const { data } = await db
      .from("books")
      .select("id")
      .eq("isbn13", external.isbn13)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }
  return null;
}

/**
 * Importe un livre externe dans le catalogue partagé, sans doublon.
 * Renvoie toujours un résultat, jamais d'exception.
 */
export async function importBook(
  external: ExternalBook,
  addedBy?: string | null,
): Promise<ImportResult> {
  try {
    if (!external?.title?.trim()) {
      return { ok: false, message: "Ce résultat n'a pas de titre exploitable." };
    }

    const db = await getWriteClient();
    if (!db) {
      return {
        ok: false,
        message:
          "Mode démonstration : connectez Supabase pour enrichir le catalogue.",
      };
    }

    const existingId = await findExisting(db, external);
    if (existingId) {
      await linkGenres(db, existingId, external.genre_slugs);
      return { ok: true, id: existingId, created: false };
    }

    const { data, error } = await db
      .from("books")
      .insert({
        source: external.source,
        source_id: external.source_id,
        isbn13: external.isbn13,
        title: external.title.trim(),
        subtitle: external.subtitle,
        authors: external.authors.length ? external.authors : [],
        cover_url: external.cover_url,
        description: external.description,
        published_year: external.published_year,
        page_count: external.page_count,
        language: external.language,
        added_by: addedBy ?? null,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      // Course entre deux imports simultanés : le livre existe peut-être déjà.
      const raced = await findExisting(db, external);
      if (raced) {
        await linkGenres(db, raced, external.genre_slugs);
        return { ok: true, id: raced, created: false };
      }
      console.warn("[books] import impossible :", error?.message);
      return { ok: false, message: "L'import a échoué. Réessayez dans un instant." };
    }

    const id = String(data.id);
    await linkGenres(db, id, external.genre_slugs);
    return { ok: true, id, created: true };
  } catch (error) {
    console.warn("[books] import impossible :", error);
    return { ok: false, message: "L'import a échoué. Réessayez dans un instant." };
  }
}

export interface ManualBookInput {
  title: string;
  authors: string[];
  published_year: number | null;
  page_count: number | null;
  cover_url: string | null;
  description: string | null;
  genre_slugs: string[];
}

/** Ajout « à la main » d'un livre absent des catalogues externes. */
export async function createManualBook(
  input: ManualBookInput,
  addedBy?: string | null,
): Promise<ImportResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, message: "Le titre est obligatoire." };

  return importBook(
    {
      source: "manual",
      // Clé de dédup stable pour une saisie manuelle : titre + premier auteur.
      source_id: `manual:${title.toLowerCase()}|${(input.authors[0] ?? "").toLowerCase()}`,
      isbn13: null,
      title,
      subtitle: null,
      authors: input.authors.filter(Boolean).slice(0, 5),
      cover_url: input.cover_url,
      description: input.description,
      published_year: input.published_year,
      page_count: input.page_count,
      language: "fr",
      genre_slugs: input.genre_slugs,
    },
    addedBy,
  );
}
