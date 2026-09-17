import { NextResponse, type NextRequest } from "next/server";
import { searchExternalBooksDetailed } from "@/lib/books/search";

/**
 * Recherche externe (Open Library, puis Google Books en secours), utilisée
 * par la page Découvrir quand le catalogue local ne trouve rien.
 * Sans clé d'API des deux côtés.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const cleaned = q.trim();
  if (cleaned.length < 2) {
    return NextResponse.json({ items: [], source: "aucune" });
  }

  const result = await searchExternalBooksDetailed(cleaned, 20);
  return NextResponse.json(result);
}
