import type { Metadata } from "next";
import { JoinByCodeAuto } from "@/components/social/JoinByCodeAuto";
import { JoinCommunityForm } from "@/components/social/CommunityForms";
import { EmptyState } from "@/components/ui/States";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rejoindre une communauté" };

export default async function RejoindrePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="py-10">
        <EmptyState
          emoji="🔑"
          title="Connectez-vous pour rejoindre cette communauté"
          actionLabel="Se connecter"
          actionHref={`/connexion?suite=${encodeURIComponent(
            `/communaute/rejoindre${code ? `?code=${code}` : ""}`,
          )}`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <h1 className="font-display text-xl font-extrabold">Rejoindre une communauté</h1>
      {code ? <JoinByCodeAuto code={code} /> : <JoinCommunityForm />}
    </div>
  );
}
