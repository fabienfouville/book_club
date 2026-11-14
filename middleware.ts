import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/** Routes exigeant une session ouverte. */
const PROTECTED = [
  "/bibliotheque",
  "/amis",
  "/emprunts",
  "/reglages",
  "/bienvenue",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Rafraîchit le jeton d'accès si nécessaire.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/connexion" || pathname === "/inscription")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

// Le middleware ne tourne que là où il sert (pages réservées aux membres et
// pages de connexion) : sur les pages publiques, chaque passage coûtait une
// invocation serveur et un appel à Supabase. La session reste lue par les
// composants serveur partout ailleurs.
export const config = {
  matcher: [
    "/bibliotheque/:path*",
    "/amis/:path*",
    "/emprunts/:path*",
    "/reglages/:path*",
    "/bienvenue/:path*",
    "/communaute/:path*",
    "/connexion",
    "/inscription",
  ],
};
