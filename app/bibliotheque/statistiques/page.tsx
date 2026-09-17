import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/States";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { SectionTitle } from "@/components/ui/Card";
import { StatsView } from "@/components/library/StatsView";
import { computeStats, getMyLibrary } from "@/lib/library/queries";

export const metadata: Metadata = {
  title: "Mes statistiques de lecture",
  description:
    "Livres lus, pages avalées, genres de prédilection et rythme de lecture sur douze mois.",
};

export default async function StatistiquesPage() {
  const { demo, anonymous, entries } = await getMyLibrary();

  const entete = (
    <div className="space-y-2">
      <Link
        href="/bibliotheque"
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary"
      >
        ← Ma bibliothèque
      </Link>
      <SectionTitle
        title="Mes statistiques"
        subtitle="Ce que vos étagères racontent de vous."
      />
    </div>
  );

  if (demo) {
    return (
      <div className="space-y-4">
        {entete}
        <DemoNotice />
      </div>
    );
  }

  if (anonymous) {
    return (
      <div className="space-y-4">
        {entete}
        <EmptyState
          emoji="🔐"
          title="Connectez-vous pour voir vos chiffres"
          actionLabel="Se connecter"
          actionHref="/connexion?suite=%2Fbibliotheque%2Fstatistiques"
        />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        {entete}
        <EmptyState
          emoji="📈"
          title="Pas encore de quoi compter"
          description="Ajoutez et terminez quelques livres : vos genres favoris et votre rythme apparaîtront ici."
          actionLabel="Trouver un livre"
          actionHref="/decouvrir"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {entete}
      <StatsView stats={computeStats(entries)} />
    </div>
  );
}
