import type { Metadata } from "next";
import Link from "next/link";
import { BookCover } from "@/components/books/BookCover";
import { Avatar } from "@/components/ui/Avatar";
import { ChipLink, ChipRow } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/States";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { LoanActions } from "@/components/social/LoanActions";
import { createClient } from "@/lib/supabase/server";
import { getLoanRequests, personName } from "@/lib/social/queries";
import { LOAN_STATUS_LABELS } from "@/types/database";
import type { LoanRequestView } from "@/lib/social/types";

export const metadata: Metadata = { title: "Emprunts" };
export const revalidate = 0;

const STATUS_TONE: Record<string, string> = {
  pending: "bg-primary-soft text-primary",
  accepted: "bg-primary-soft text-primary",
  borrowed: "bg-accent-soft text-accent",
  returned: "bg-surface-muted text-success",
  declined: "bg-surface-muted text-danger",
  cancelled: "bg-surface-muted text-ink-faint",
};

function LoanRow({ view, role }: { view: LoanRequestView; role: "owner" | "borrower" }) {
  const { loan, book, owner, borrower } = view;
  const other = role === "owner" ? borrower : owner;

  return (
    <li className="bc-card flex gap-3 p-3">
      {book ? (
        <Link href={`/livre/${book.id}`} className="w-14 shrink-0">
          <BookCover title={book.title} url={book.cover_url} sizes="56px" />
        </Link>
      ) : (
        <div className="w-14 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {book ? (
              <Link href={`/livre/${book.id}`} className="text-sm font-semibold hover:text-primary">
                {book.title}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-ink-faint">Livre supprimé</span>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
              <Avatar name={personName(other)} url={other?.avatar_url} size={20} />
              <span>
                {role === "owner" ? "Emprunté par " : "Prêté par "}
                {other ? personName(other) : "quelqu'un"}
              </span>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[loan.status] ?? ""}`}
          >
            {LOAN_STATUS_LABELS[loan.status]}
          </span>
        </div>

        {loan.message ? (
          <p className="mt-1.5 text-xs text-ink-soft">« {loan.message} »</p>
        ) : null}
        {loan.due_at ? (
          <p className="mt-1 text-xs text-ink-faint">
            Retour souhaité le {new Date(loan.due_at).toLocaleDateString("fr-FR")}
          </p>
        ) : null}

        <LoanActions loanId={loan.id} status={loan.status} role={role} />
      </div>
    </li>
  );
}

export default async function EmpruntsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { onglet } = await searchParams;
  const tab = onglet === "envoyees" ? "envoyees" : "recues";

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="space-y-4 py-4">
        <h1 className="font-display text-xl font-extrabold">Emprunts</h1>
        <DemoNotice />
      </div>
    );
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return (
      <div className="py-10">
        <EmptyState
          emoji="🤝"
          title="Connectez-vous pour voir vos emprunts"
          actionLabel="Se connecter"
          actionHref="/connexion?suite=/emprunts"
        />
      </div>
    );
  }

  const { received, sent } = await getLoanRequests(supabase, data.user.id);
  const items = tab === "recues" ? received : sent;

  return (
    <div className="space-y-4 py-4">
      <h1 className="font-display text-xl font-extrabold sm:text-2xl">Emprunts</h1>

      <ChipRow label="Onglet">
        <ChipLink href="/emprunts?onglet=recues" active={tab === "recues"}>
          Demandes reçues {received.length ? `(${received.length})` : ""}
        </ChipLink>
        <ChipLink href="/emprunts?onglet=envoyees" active={tab === "envoyees"}>
          Mes demandes {sent.length ? `(${sent.length})` : ""}
        </ChipLink>
      </ChipRow>

      {items.length === 0 ? (
        <EmptyState
          emoji="📦"
          title={
            tab === "recues"
              ? "Aucune demande reçue"
              : "Vous n'avez encore rien demandé"
          }
          description={
            tab === "recues"
              ? "Quand un ami voudra emprunter un de vos livres, la demande apparaîtra ici."
              : "Depuis la fiche d'un livre prêté par un ami, demandez-le en un clic."
          }
          actionLabel="Découvrir des livres"
          actionHref="/decouvrir"
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((view) => (
            <LoanRow
              key={view.loan.id}
              view={view}
              role={tab === "recues" ? "owner" : "borrower"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
