import type { Metadata } from "next";
import Link from "next/link";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { SectionTitle } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { IconSearch, IconUsers } from "@/components/ui/Icons";
import { ActionButton } from "@/components/social/ActionButton";
import { FriendMenu } from "@/components/social/FriendMenu";
import { PersonRow } from "@/components/social/PersonRow";
import { createClient } from "@/lib/supabase/server";
import {
  getFriendshipBuckets,
  personName,
  searchProfilesByUsername,
} from "@/lib/social/queries";
import { formatRelative } from "@/lib/social/format";
import type { FriendState, ProfileLite } from "@/lib/social/types";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "./actions";

export const metadata: Metadata = {
  title: "Amis",
  description: "Vos amis, vos demandes reçues et envoyées sur Bookclub.",
};

export default async function AmisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="space-y-4 py-2">
        <h1 className="font-display text-2xl font-extrabold">Mes amis</h1>
        <DemoNotice />
      </div>
    );
  }

  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user;
  if (!me) {
    return (
      <div className="py-8">
        <EmptyState
          emoji="🔐"
          title="Connectez-vous pour retrouver vos amis"
          description="Les amitiés, les recommandations et les emprunts demandent un compte."
          actionLabel="Se connecter"
          actionHref="/connexion"
        />
      </div>
    );
  }

  const buckets = await getFriendshipBuckets(supabase, me.id);
  const results: ProfileLite[] = query
    ? await searchProfilesByUsername(supabase, query, me.id)
    : [];

  // État connu de chaque relation, pour afficher le bon bouton en résultat.
  const stateById = new Map<string, FriendState>();
  for (const e of buckets.friends) stateById.set(e.profile.id, "friends");
  for (const e of buckets.received) stateById.set(e.profile.id, "received");
  for (const e of buckets.sent) stateById.set(e.profile.id, "sent");

  return (
    <div className="space-y-8 py-2">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Mes amis
        </h1>
        <p className="text-sm text-ink-soft">
          Trouvez des lecteurs, échangez vos coups de cœur et prêtez-vous des
          livres.
        </p>
      </header>

      <nav aria-label="Raccourcis sociaux" className="flex flex-wrap gap-2">
        <ButtonLink href="/amis/recommandations" variant="secondary" size="sm">
          ✨ Recommandations
        </ButtonLink>
        <ButtonLink href="/communaute" variant="secondary" size="sm">
          👥 Communautés
        </ButtonLink>
        <ButtonLink href="/emprunts" variant="secondary" size="sm">
          🤝 Emprunts
        </ButtonLink>
      </nav>

      {/* --------------------------------------------------------- recherche */}
      <section aria-labelledby="titre-recherche">
        <SectionTitle
          title="Trouver un lecteur"
          subtitle="Recherchez par pseudo, deux lettres suffisent."
        />
        <form action="/amis" method="get" role="search" className="flex gap-2">
          <label htmlFor="recherche-amis" className="sr-only">
            Rechercher un membre par pseudo
          </label>
          <Input
            id="recherche-amis"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="pseudo…"
            autoComplete="off"
          />
          <button
            type="submit"
            aria-label="Lancer la recherche"
            className="bc-gradient grid min-h-[46px] w-[46px] shrink-0 place-items-center rounded-xl text-white shadow-tiny transition hover:brightness-110"
          >
            <IconSearch className="h-5 w-5" aria-hidden />
          </button>
        </form>

        {query ? (
          results.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {results.map((profile) => (
                <PersonRow
                  key={profile.id}
                  profile={profile}
                  href={`/profil/${profile.username}`}
                  actions={
                    <FriendMenu
                      profileId={profile.id}
                      username={profile.username}
                      state={stateById.get(profile.id) ?? "none"}
                      size="sm"
                    />
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-ink-soft">
              Aucun membre ne correspond à «&nbsp;{query}&nbsp;».
            </p>
          )
        ) : null}
      </section>

      {/* ---------------------------------------------------- demandes reçues */}
      {buckets.received.length > 0 ? (
        <section aria-labelledby="titre-recues">
          <SectionTitle
            title={`Demandes reçues (${buckets.received.length})`}
            subtitle="Elles attendent votre réponse."
          />
          <ul className="space-y-2">
            {buckets.received.map(({ friendship, profile }) => (
              <PersonRow
                key={friendship.id}
                profile={profile}
                href={`/profil/${profile.username}`}
                subtitle={formatRelative(friendship.created_at)}
                actions={
                  <>
                    <ActionButton
                      action={acceptFriendRequest.bind(null, profile.id)}
                      variant="primary"
                      ariaLabel={`Accepter la demande de ${personName(profile)}`}
                    >
                      Accepter
                    </ActionButton>
                    <ActionButton
                      action={declineFriendRequest.bind(null, profile.id)}
                      variant="ghost"
                      ariaLabel={`Refuser la demande de ${personName(profile)}`}
                    >
                      Refuser
                    </ActionButton>
                  </>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------------- amis */}
      <section aria-labelledby="titre-amis">
        <SectionTitle
          title={`Mes amis (${buckets.friends.length})`}
          subtitle="Ouvrez leur bibliothèque pour voir ce qu'ils prêtent."
        />
        {buckets.friends.length > 0 ? (
          <ul className="space-y-2">
            {buckets.friends.map(({ friendship, profile }) => (
              <PersonRow
                key={friendship.id}
                profile={profile}
                href={`/amis/${profile.username}`}
                actions={
                  <>
                    <Link
                      href={`/amis/${profile.username}`}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-border-strong px-3 text-sm font-semibold text-ink-soft transition hover:bg-surface-muted"
                    >
                      <IconUsers className="h-4 w-4" aria-hidden />
                      Sa biblio
                    </Link>
                    <ActionButton
                      action={removeFriend.bind(null, profile.id)}
                      variant="ghost"
                      confirmLabel="Confirmer le retrait"
                      ariaLabel={`Retirer ${personName(profile)} de mes amis`}
                    >
                      Retirer
                    </ActionButton>
                  </>
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            emoji="🫂"
            title="Pas encore d'amis ici"
            description="Cherchez un pseudo ci-dessus, ou rejoignez une communauté pour rencontrer des lecteurs."
            actionLabel="Voir les communautés"
            actionHref="/communaute"
          />
        )}
      </section>

      {/* -------------------------------------------------- demandes envoyées */}
      {buckets.sent.length > 0 ? (
        <section aria-labelledby="titre-envoyees">
          <SectionTitle
            title={`Demandes envoyées (${buckets.sent.length})`}
            subtitle="En attente de leur réponse."
          />
          <ul className="space-y-2">
            {buckets.sent.map(({ friendship, profile }) => (
              <PersonRow
                key={friendship.id}
                profile={profile}
                href={`/profil/${profile.username}`}
                subtitle={formatRelative(friendship.created_at)}
                actions={
                  <ActionButton
                    action={cancelFriendRequest.bind(null, profile.id)}
                    variant="ghost"
                    ariaLabel={`Annuler la demande envoyée à ${personName(profile)}`}
                  >
                    Annuler
                  </ActionButton>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
