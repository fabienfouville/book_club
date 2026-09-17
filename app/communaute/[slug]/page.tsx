import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { BookCover } from "@/components/books/BookCover";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { CopyField } from "@/components/social/CopyField";
import { PersonRow } from "@/components/social/PersonRow";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/config";
import {
  getCommunityBySlug,
  getCommunityMembers,
  getGroupActivity,
  getSharedShelf,
  personName,
} from "@/lib/social/queries";
import { relativeDateFr } from "@/lib/library/dates";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const community = supabase ? await getCommunityBySlug(supabase, slug) : null;
  return { title: community?.name ?? "Communauté" };
}

function activityLabel(entry: { kind: string; rating?: number; shelf?: string }) {
  if (entry.kind === "rating") return `a noté ${entry.rating}★`;
  if (entry.kind === "review") return "a écrit un avis sur";
  if (entry.shelf === "read") return "a terminé";
  if (entry.shelf === "reading") return "a commencé";
  return "a ajouté";
}

export default async function CommunauteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const community = await getCommunityBySlug(supabase, slug);
  if (!community) notFound();

  const { data: auth } = await supabase.auth.getUser();
  const members = await getCommunityMembers(supabase, community.id);
  const isMember = Boolean(auth.user && members.some((m) => m.profile.id === auth.user!.id));
  const memberIds = members.map((m) => m.profile.id);

  const [shelf, activity] = await Promise.all([
    getSharedShelf(supabase, memberIds, { limit: 60 }),
    getGroupActivity(supabase, memberIds, 12),
  ]);
  const lendable = shelf.filter((entry) => entry.is_lendable);

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">{community.name}</h1>
        {community.description ? (
          <p className="mt-1 text-sm text-ink-soft">{community.description}</p>
        ) : null}
        <p className="mt-1 text-xs text-ink-faint">
          {members.length} membre{members.length > 1 ? "s" : ""} ·{" "}
          {community.is_open ? "Ouverte" : "Sur invitation"}
        </p>
      </div>

      {isMember ? (
        <div className="bc-card space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">Inviter des amis</p>
          <CopyField
            label="Lien d'invitation"
            value={`${SITE_URL}/communaute/rejoindre?code=${community.invite_code}`}
          />
          <CopyField label="Ou le code seul" value={community.invite_code} mono />
        </div>
      ) : (
        <div className="bc-card p-4">
          <p className="text-sm text-ink-soft">
            Vous n&apos;êtes pas encore membre de cette communauté.
          </p>
          <ButtonLink href="/communaute" size="sm" className="mt-2">
            Rejoindre avec un code
          </ButtonLink>
        </div>
      )}

      <section className="space-y-2.5">
        <h2 className="font-display text-lg font-bold">Membres</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <PersonRow
              key={m.profile.id}
              profile={m.profile}
              href={`/profil/${m.profile.username}`}
              subtitle={m.role === "owner" ? "Propriétaire" : undefined}
            />
          ))}
        </ul>
      </section>

      {lendable.length ? (
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold">Disponibles à l&apos;emprunt</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {lendable.map((entry) => (
              <Link key={`${entry.owner.id}-${entry.book.id}`} href={`/livre/${entry.book.id}`}>
                <BookCover title={entry.book.title} url={entry.book.cover_url} />
                <p className="mt-1 truncate text-xs font-semibold">{entry.book.title}</p>
                <p className="truncate text-[11px] text-ink-soft">
                  chez {personName(entry.owner)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2.5">
        <h2 className="font-display text-lg font-bold">Étagère partagée</h2>
        {shelf.length === 0 ? (
          <EmptyState emoji="📚" title="Personne n'a encore ajouté de livre possédé" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shelf.map((entry) => (
              <Link key={`${entry.owner.id}-${entry.book.id}`} href={`/livre/${entry.book.id}`}>
                <BookCover title={entry.book.title} url={entry.book.cover_url} />
                <p className="mt-1 truncate text-xs font-semibold">{entry.book.title}</p>
                <p className="truncate text-[11px] text-ink-soft">
                  chez {personName(entry.owner)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {activity.length ? (
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold">Activité récente</h2>
          <ul className="space-y-2">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2.5 text-sm">
                <Avatar name={personName(entry.profile)} url={entry.profile.avatar_url} size={28} />
                <p className="min-w-0 truncate text-ink-soft">
                  <span className="font-semibold text-ink">{personName(entry.profile)}</span>{" "}
                  {activityLabel(entry)}{" "}
                  {entry.book ? (
                    <Link href={`/livre/${entry.book.id}`} className="font-medium text-primary">
                      {entry.book.title}
                    </Link>
                  ) : null}
                  <span className="ml-1.5 text-xs text-ink-faint">
                    · {relativeDateFr(entry.at)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
