import type { Metadata } from "next";
import Link from "next/link";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { ChipLink } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/States";
import { Avatar } from "@/components/ui/Avatar";
import { BookCover } from "@/components/books/BookCover";
import { ActionButton } from "@/components/social/ActionButton";
import { createClient } from "@/lib/supabase/server";
import { getRecommendations, personName } from "@/lib/social/queries";
import { formatRelative } from "@/lib/social/format";
import type { RecommendationView } from "@/lib/social/types";
import { dismissRecommendation, saveRecommendation } from "./actions";

export const metadata: Metadata = {
  title: "Recommandations",
  description: "Les livres que vos amis vous conseillent.",
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Envoyée",
  seen: "Vue",
  saved: "Ajoutée à sa liste",
  dismissed: "Écartée",
};

function RecommendationCard({
  view,
  direction,
}: {
  view: RecommendationView;
  direction: "received" | "sent";
}) {
  const { recommendation, book } = view;
  const person = direction === "received" ? view.from : view.to;

  return (
    <li className="bc-card flex gap-3 p-3">
      <div className="w-20 shrink-0 sm:w-24">
        {book ? (
          <Link href={`/livre/${book.id}`} aria-label={`Voir « ${book.title} »`}>
            <BookCover
              title={book.title}
              authors={book.authors}
              url={book.cover_url}
              sizes="96px"
            />
          </Link>
        ) : (
          <div className="aspect-2/3 w-full rounded-xl bg-surface-muted" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Avatar
            name={personName(person)}
            url={person?.avatar_url}
            size={26}
          />
          <p className="min-w-0 truncate text-xs text-ink-soft">
            {direction === "received" ? "De" : "À"}{" "}
            {person ? (
              <Link
                href={`/profil/${person.username}`}
                className="font-semibold text-ink hover:text-primary"
              >
                {personName(person)}
              </Link>
            ) : (
              "un membre"
            )}
            {" · "}
            {formatRelative(recommendation.created_at)}
          </p>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold leading-snug">
            {book ? (
              <Link href={`/livre/${book.id}`} className="hover:text-primary">
                {book.title}
              </Link>
            ) : (
              "Livre indisponible"
            )}
          </h3>
          {book?.authors?.length ? (
            <p className="truncate text-xs text-ink-soft">{book.authors[0]}</p>
          ) : null}
        </div>

        {recommendation.message ? (
          <blockquote className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-ink">
            «&nbsp;{recommendation.message}&nbsp;»
          </blockquote>
        ) : null}

        {direction === "received" ? (
          <div className="flex flex-wrap items-center gap-2">
            {recommendation.status === "saved" ? (
              <span className="text-xs font-semibold text-success">
                Ajouté à vos envies de lire ✓
              </span>
            ) : (
              <ActionButton
                action={saveRecommendation.bind(null, recommendation.id)}
                variant="primary"
                ariaLabel={`Ajouter « ${book?.title ?? "ce livre"} » à mes envies de lire`}
              >
                Ajouter à ma liste
              </ActionButton>
            )}
            {book ? (
              <Link
                href={`/livre/${book.id}`}
                className="inline-flex min-h-[38px] items-center rounded-full border border-border-strong px-3 text-sm font-semibold text-ink-soft transition hover:bg-surface-muted"
              >
                Voir le livre
              </Link>
            ) : null}
            <ActionButton
              action={dismissRecommendation.bind(null, recommendation.id)}
              variant="ghost"
              ariaLabel="Écarter cette recommandation"
            >
              Écarter
            </ActionButton>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">
            {STATUS_LABELS[recommendation.status] ?? recommendation.status}
          </p>
        )}
      </div>
    </li>
  );
}

export default async function RecommandationsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { onglet } = await searchParams;
  const tab = onglet === "envoyees" ? "envoyees" : "recues";

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="space-y-4 py-2">
        <h1 className="font-display text-2xl font-extrabold">Recommandations</h1>
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
          title="Connectez-vous pour voir vos recommandations"
          actionLabel="Se connecter"
          actionHref="/connexion"
        />
      </div>
    );
  }

  const { received, sent } = await getRecommendations(supabase, me.id);
  const list = tab === "envoyees" ? sent : received;

  return (
    <div className="space-y-5 py-2">
      <header className="space-y-1">
        <Link
          href="/amis"
          className="inline-flex min-h-[38px] items-center text-sm font-semibold text-ink-soft hover:text-primary"
        >
          ← Amis
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Recommandations
        </h1>
        <p className="text-sm text-ink-soft">
          Les livres que vos amis vous mettent entre les mains.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Sens des recommandations"
        className="flex gap-2"
      >
        <ChipLink href="/amis/recommandations" active={tab === "recues"}>
          Reçues ({received.length})
        </ChipLink>
        <ChipLink
          href="/amis/recommandations?onglet=envoyees"
          active={tab === "envoyees"}
        >
          Envoyées ({sent.length})
        </ChipLink>
      </div>

      {list.length > 0 ? (
        <ul className="space-y-3">
          {list.map((view) => (
            <RecommendationCard
              key={view.recommendation.id}
              view={view}
              direction={tab === "envoyees" ? "sent" : "received"}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          emoji="✨"
          title={
            tab === "envoyees"
              ? "Vous n'avez rien recommandé pour l'instant"
              : "Aucune recommandation pour le moment"
          }
          description={
            tab === "envoyees"
              ? "Depuis la fiche d'un livre, le bouton « Recommander à un ami » fait passer le mot."
              : "Quand un ami vous conseillera un livre, il apparaîtra ici."
          }
          actionLabel="Découvrir des livres"
          actionHref="/decouvrir"
        />
      )}
    </div>
  );
}
