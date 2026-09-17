import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/States";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { CreateCommunityForm, JoinCommunityForm } from "@/components/social/CommunityForms";
import { createClient } from "@/lib/supabase/server";
import { getMyCommunities } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Communautés" };
export const revalidate = 0;

export default async function CommunautePage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="space-y-4 py-4">
        <h1 className="font-display text-xl font-extrabold">Communautés</h1>
        <DemoNotice />
      </div>
    );
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return (
      <div className="py-10">
        <EmptyState
          emoji="🏛️"
          title="Connectez-vous pour voir vos communautés"
          actionLabel="Se connecter"
          actionHref="/connexion?suite=/communaute"
        />
      </div>
    );
  }

  const communities = await getMyCommunities(supabase, data.user.id);

  return (
    <div className="space-y-6 py-4">
      <h1 className="font-display text-xl font-extrabold sm:text-2xl">Communautés</h1>

      {communities.length === 0 ? (
        <EmptyState
          emoji="🏛️"
          title="Aucune communauté pour l'instant"
          description="Créez la vôtre ou rejoignez celle d'un ami grâce à un code."
        />
      ) : (
        <ul className="space-y-2.5">
          {communities.map(({ community, role, members_count }) => (
            <li key={community.id}>
              <Link
                href={`/communaute/${community.slug}`}
                className="bc-card flex items-center justify-between gap-3 p-4 transition hover:bg-surface-muted"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold">{community.name}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {members_count} membre{members_count > 1 ? "s" : ""}
                    {role === "owner" ? " · Vous êtes propriétaire" : ""}
                  </p>
                </div>
                <span aria-hidden className="text-2xl">🏛️</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CreateCommunityForm />
        <JoinCommunityForm />
      </div>
    </div>
  );
}
