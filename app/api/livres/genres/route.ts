import { NextResponse, type NextRequest } from "next/server";
import { getOpenLibraryWork } from "@/lib/books/openlibrary";
import { searchGoogleBooks } from "@/lib/books/googlebooks";

/**
 * Suggestion de genre à l'import : la recherche Open Library ne renvoie que
 * quelques sujets tronqués (souvent rien d'exploitable). On interroge ici
 * la fiche complète de l'œuvre (`/works/{id}.json`, sujets exhaustifs),
 * et Google Books en second avis si toujours rien. Sans clé, sans quota.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const source = sp.get("source");
  const sourceId = sp.get("source_id") ?? "";
  const title = sp.get("title") ?? "";
  const author = sp.get("author") ?? "";

  const genres = new Set<string>();

  if (source === "openlibrary" && sourceId) {
    try {
      const work = await getOpenLibraryWork(sourceId);
      work?.genre_slugs.forEach((g) => genres.add(g));
    } catch {
      // on retombe sur Google Books ci-dessous
    }
  }

  if (genres.size === 0 && title) {
    try {
      const [hit] = await searchGoogleBooks(`${title} ${author}`.trim(), 1);
      hit?.genre_slugs.forEach((g) => genres.add(g));
    } catch {
      // aucune source n'a rien donné : on renvoie une liste vide
    }
  }

  return NextResponse.json({ genres: [...genres].slice(0, 4) });
}
