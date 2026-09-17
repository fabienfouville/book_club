"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { IconSparkle } from "@/components/ui/Icons";
import { Sheet } from "./Sheet";
import { listMyFriends } from "@/app/amis/actions";
import { recommendBook } from "@/app/amis/recommandations/actions";
import { personName } from "@/lib/social/queries";
import type { ProfileLite } from "@/lib/social/types";

/**
 * « Recommander à un ami » : choix multiple, petit mot, envoi.
 * La liste d'amis peut être fournie par l'appelant, sinon elle est chargée
 * à l'ouverture du panneau.
 */
export function RecommendBookDialog({
  bookId,
  bookTitle,
  friends: initialFriends,
  label = "Recommander à un ami",
  variant = "secondary",
  className,
}: {
  bookId: string;
  bookTitle?: string;
  friends?: ProfileLite[];
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<ProfileLite[] | null>(
    initialFriends ?? null,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || friends !== null) return;
    let alive = true;
    startTransition(async () => {
      const result = await listMyFriends();
      if (!alive) return;
      if (result.ok) setFriends(result.friends);
      else setError(result.error);
    });
    return () => {
      alive = false;
    };
  }, [open, friends]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await recommendBook({
        bookId,
        friendIds: selected,
        message,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(
        result.sent > 1
          ? `Recommandation envoyée à ${result.sent} amis.`
          : "Recommandation envoyée.",
      );
      setSelected([]);
      setMessage("");
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => {
          setDone(null);
          setOpen(true);
        }}
        aria-label={
          bookTitle ? `Recommander « ${bookTitle} » à un ami` : label
        }
      >
        <IconSparkle className="h-4 w-4" aria-hidden />
        {label}
      </Button>

      {done ? (
        <p role="status" className="mt-1 text-xs text-success">
          {done}
        </p>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Recommander ce livre"
        description={bookTitle ? `« ${bookTitle} »` : undefined}
      >
        {friends === null ? (
          <p className="py-6 text-center text-sm text-ink-soft">
            Chargement de vos amis…
          </p>
        ) : friends.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">
            Vous n&apos;avez pas encore d&apos;amis sur Bookclub. Ajoutez-en
            depuis la page Amis pour partager vos coups de cœur.
          </p>
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">
                À qui ?
              </legend>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {friends.map((friend) => {
                  const checked = selected.includes(friend.id);
                  return (
                    <li key={friend.id}>
                      <label
                        className={
                          "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 transition " +
                          (checked
                            ? "border-primary bg-primary-soft"
                            : "border-border hover:bg-surface-muted")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(friend.id)}
                          className="h-5 w-5 accent-current text-primary"
                        />
                        <Avatar
                          name={personName(friend)}
                          url={friend.avatar_url}
                          size={34}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {personName(friend)}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            @{friend.username}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <Field
              label="Votre mot (facultatif)"
              htmlFor="reco-message"
              hint="500 caractères maximum."
            >
              <Textarea
                id="reco-message"
                value={message}
                maxLength={500}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Je crois que ça va te plaire…"
              />
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={pending || selected.length === 0}
                className="flex-1"
              >
                {pending ? "Envoi…" : "Envoyer"}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

export default RecommendBookDialog;
