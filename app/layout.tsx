import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav, SideNav } from "@/components/ui/Nav";
import { TopBar } from "@/components/ui/TopBar";
import { themeScript } from "@/components/ui/ThemeToggle";
import { getCurrentProfile } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Bookclub — votre bibliothèque partagée",
    template: "%s · Bookclub",
  },
  description:
    "Référencez vos livres, notez-les, écrivez vos avis, recevez des recommandations taillées pour vous et prêtez vos exemplaires à vos amis.",
  applicationName: "Bookclub",
  manifest: "/manifeste.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Bookclub",
    locale: "fr_FR",
    title: "Bookclub — votre bibliothèque partagée",
    description:
      "La plateforme collaborative de notation et de recommandation de lecture.",
  },
  icons: { icon: "/icone.svg", apple: "/icone.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7534d1" },
    { media: "(prefers-color-scheme: dark)", color: "#140a29" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
        >
          Aller au contenu
        </a>

        <TopBar
          username={profile?.username}
          displayName={profile?.display_name}
          avatarUrl={profile?.avatar_url}
        />

        <div className="mx-auto flex max-w-6xl gap-8 px-4 pt-5">
          <aside className="hidden w-48 shrink-0 md:block">
            <SideNav />
          </aside>
          <main id="contenu" className="min-w-0 flex-1 pb-28 md:pb-16">
            {children}
          </main>
        </div>

        <BottomNav />
      </body>
    </html>
  );
}
