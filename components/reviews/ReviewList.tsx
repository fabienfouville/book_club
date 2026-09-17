import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { StarsDisplay } from "@/components/ui/Stars";
import { EmptyState } from "@/components/ui/States";
import { getBookReviews } from "@/lib/library/queries";
import { fullDateFr, relativeDateFr } from "@/lib/library/dates";
import type { ReviewWithAuthor } from "@/lib/library/types";
import { ReviewLikeButton } from "./ReviewLikeButton";
import { SpoilerGuard } from "./SpoilerGuard";

function ReviewCard({
  review,
  anonymous,
  demo,
}: {
  review: ReviewWithAuthor;
  anonymous: boolean;
  demo: boolean;
}) {
  const nom = review.author.display_name || review.author.username;
  const corps = (
    <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
      {review.body}
    </p>
  );

  return (
    <article className="bc-card p-4">
      <header className="flex items-start gap-3">
        <Link
          href={`/profil/${review.author.username}`}
          aria-label={`Profil de ${nom}`}
          className="rounded-full ring-2 ring-transparent transition hover:ring-primary"
        >
          <Avatar name={nom} url={review.author.avatar_url} size={40} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link
              href={`/profil/${review.author.username}`}
              className="truncate font-semibold text-ink hover:text-primary"
            >
              {nom}
            </Link>
            {review.mine ? (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                Vous
              </span>
            ) : null}
          </div>
          <p className="text-xs text-ink-faint">
            <time dateTime={review.created_at} title={fullDateFr(review.created_at)}>
              {relativeDateFr(review.created_at)}
            </time>
          </p>
        </div>

        {review.author_rating ? (
          <div className="shrink-0 pt-0.5">
            <StarsDisplay value={review.author_rating} size={14} />
          </div>
        ) : null}
      </header>

      <div className="mt-3">
        {review.has_spoiler ? <SpoilerGuard>{corps}</SpoilerGuard> : corps}
      </div>

      <footer className="mt-3">
        <ReviewLikeButton
          reviewId={review.id}
          bookId={review.book_id}
          count={review.likes_count}
          liked={review.liked_by_me}
          disabled={anonymous || demo}
        />
      </footer>
    </article>
  );
}

/** Le fil des avis d'un livre. Va chercher ses données lui-même. */
export async function ReviewList({ bookId }: { bookId: string }) {
  const { reviews, anonymous, demo } = await getBookReviews(bookId);

  if (reviews.length === 0) {
    return (
      <EmptyState
        emoji="🪶"
        title="Aucun avis pour l'instant"
        description="Soyez la première personne à dire ce que ce livre vous a fait."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        {reviews.length === 1 ? "1 avis" : `${reviews.length} avis`}
      </p>
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          anonymous={anonymous}
          demo={demo}
        />
      ))}
    </div>
  );
}

export default ReviewList;
