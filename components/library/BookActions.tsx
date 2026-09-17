import { ButtonLink } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { getBookUserState } from "@/lib/library/queries";
import { BookActionsClient } from "./BookActionsClient";

/**
 * Le bloc d'actions de la fiche livre. Il ne reçoit que l'identifiant du
 * livre et va chercher lui-même l'état de l'utilisateur courant, pour que la
 * fiche n'ait rien à savoir de la bibliothèque.
 */
export async function BookActions({ bookId }: { bookId: string }) {
  const etat = await getBookUserState(bookId);

  // Mode démo : on montre l'interface, désactivée, plutôt qu'un trou.
  if (etat.demo) {
    return (
      <div className="bc-card space-y-4 p-4">
        <DemoNotice />
        <div aria-hidden className="pointer-events-none select-none opacity-50">
          <BookActionsClient
            bookId={bookId}
            initial={{
              shelf: null,
              is_owned: false,
              is_lendable: false,
              rating: null,
            }}
            initialReview={null}
            disabled
          />
        </div>
      </div>
    );
  }

  if (etat.anonymous) {
    return (
      <div className="bc-card space-y-3 p-4 text-center sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <span aria-hidden className="text-3xl">
            📚
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              Rangez ce livre chez vous
            </h3>
            <p className="mt-0.5 text-sm text-ink-soft">
              Connectez-vous pour le noter, le mettre sur une étagère, dire que
              vous le possédez et écrire votre avis.
            </p>
          </div>
        </div>
        <ButtonLink
          href={`/connexion?suite=${encodeURIComponent(`/livre/${bookId}`)}`}
          className="w-full sm:w-auto"
        >
          Se connecter
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="bc-card p-4">
      <BookActionsClient
        bookId={bookId}
        initial={{
          shelf: etat.shelf,
          is_owned: etat.is_owned,
          is_lendable: etat.is_lendable,
          rating: etat.rating,
        }}
        initialReview={etat.review}
      />
    </div>
  );
}

export default BookActions;
