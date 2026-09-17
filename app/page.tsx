import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { CatalogueRail, RecommendationRail } from "@/components/books/BookRails";
import {
  demoHighlights,
  getRecommendationsFor,
  listCurrentlyReading,
  listFriendsFavourites,
  listPopular,
} from "@/lib/data/catalogue";
import { getCurrentProfile } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Accueil",
};

export const revalidate = 0;

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!isSupabaseConfigured) {
    const items = demoHighlights(12);
    return (
      <div className="space-y-8 py-4">
        <Hero />
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Le catalogue de démonstration</h2>
          <CatalogueRail label="Catalogue" items={items} />
        </section>
      </div>
    );
  }

  if (!profile) {
    const populaire = await listPopular(12, null);
    return (
      <div className="space-y-8 py-4">
        <Hero />
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Populaire en ce moment</h2>
          <CatalogueRail label="Populaire en ce moment" items={populaire} />
        </section>
      </div>
    );
  }

  const [recommandations, enCours, coupsDeCoeur, populaire] = await Promise.all([
    getRecommendationsFor(profile.id, 12),
    listCurrentlyReading(profile.id, 10),
    listFriendsFavourites(profile.id, 10),
    listPopular(12, profile.id),
  ]);

  const prenom = (profile.display_name || profile.username || "").split(" ")[0];
  const heure = new Date().getHours();
  const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">
          {salutation}{prenom ? `, ${prenom}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Voici ce que Bookclub a préparé pour vous aujourd&apos;hui.
        </p>
      </div>

      {recommandations.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Pour vous</h2>
          <RecommendationRail label="Pour vous" items={recommandations} />
        </section>
      ) : null}

      {enCours.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">En cours de lecture</h2>
          <CatalogueRail label="En cours de lecture" items={enCours} />
        </section>
      ) : null}

      {coupsDeCoeur.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Les coups de cœur de vos amis</h2>
          <RecommendationRail label="Les coups de cœur de vos amis" items={coupsDeCoeur} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Populaire en ce moment</h2>
        <CatalogueRail label="Populaire en ce moment" items={populaire} />
      </section>
    </div>
  );
}

function Hero() {
  return (
    <div className="bc-gradient overflow-hidden rounded-2xl px-5 py-8 text-white shadow-soft sm:px-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-white/80">
        Bookclub
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        Votre bibliothèque, vos amis,
        <br />
        vos prochaines lectures.
      </h1>
      <p className="mt-3 max-w-md text-sm text-white/85 sm:text-base">
        Notez vos livres, écrivez vos avis, recevez des recommandations sur
        mesure et prêtez vos exemplaires à vos amis.
      </p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <ButtonLink href="/inscription" variant="gold" size="lg">
          Créer mon compte
        </ButtonLink>
        <ButtonLink
          href="/decouvrir"
          variant="secondary"
          size="lg"
          className="border-white/40 bg-white/10 text-white hover:bg-white/20"
        >
          Explorer le catalogue
        </ButtonLink>
      </div>
    </div>
  );
}
