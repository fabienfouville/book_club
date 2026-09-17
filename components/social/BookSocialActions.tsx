import { createClient } from "@/lib/supabase/server";
import { getSocialCircle, getLendableOwners } from "@/lib/social/queries";
import { RecommendBookDialog } from "./RecommendBookDialog";
import { LoanRequestDialog } from "./LoanRequestDialog";

/**
 * Bloc social de la fiche livre : « Recommander à un ami » toujours visible
 * une fois connecté, « Demander à emprunter » seulement si quelqu'un de son
 * cercle (amis ou communautés) possède ce livre et le prête.
 */
export async function BookSocialActions({
  bookId,
  bookTitle,
}: {
  bookId: string;
  bookTitle?: string;
}) {
  const supabase = await createClient();
  if (!supabase) return null; // Mode démo : la bibliothèque n'existe pas encore.

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null; // Un visiteur non connecté est invité à se connecter par BookActions.

  const circle = await getSocialCircle(supabase, userId);
  const owners = circle.allIds.length
    ? await getLendableOwners(supabase, bookId, circle)
    : [];

  return (
    <div className="flex flex-wrap gap-2">
      <RecommendBookDialog bookId={bookId} bookTitle={bookTitle} />
      <LoanRequestDialog bookId={bookId} bookTitle={bookTitle} owners={owners} />
    </div>
  );
}

export default BookSocialActions;
