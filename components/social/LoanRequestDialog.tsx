"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { IconHandshake } from "@/components/ui/Icons";
import { Sheet } from "./Sheet";
import { requestLoan } from "@/app/emprunts/actions";
import { personName } from "@/lib/social/queries";
import type { OwnerOffer } from "@/lib/social/types";

/**
 * « Demander à emprunter » : choix du propriétaire (s'il y en a plusieurs),
 * un mot et une date de retour souhaitée, puis envoi de la demande.
 */
export function LoanRequestDialog({
  bookId,
  bookTitle,
  owners,
}: {
  bookId: string;
  bookTitle?: string;
  owners: OwnerOffer[];
}) {
  const available = owners.filter((o) => !o.unavailable);
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState(available[0]?.profile.id ?? "");
  const [message, setMessage] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (owners.length === 0) return null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await requestLoan({
        bookId,
        ownerId,
        message,
        dueAt: dueAt || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      setMessage("");
      setDueAt("");
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={available.length === 0}
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
        aria-label={
          bookTitle ? `Demander à emprunter « ${bookTitle} »` : "Demander à emprunter"
        }
      >
        <IconHandshake className="h-4 w-4" aria-hidden />
        {available.length === 0 ? "Déjà prêté" : "Demander à emprunter"}
      </Button>

      {done ? (
        <p role="status" className="mt-1 text-xs text-success">
          Demande envoyée.
        </p>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Demander à emprunter"
        description={bookTitle ? `« ${bookTitle} »` : undefined}
      >
        <div className="space-y-4">
          {available.length > 1 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">
                À qui ?
              </legend>
              <ul className="space-y-1">
                {available.map((offer) => {
                  const checked = ownerId === offer.profile.id;
                  return (
                    <li key={offer.profile.id}>
                      <label
                        className={
                          "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 transition " +
                          (checked
                            ? "border-primary bg-primary-soft"
                            : "border-border hover:bg-surface-muted")
                        }
                      >
                        <input
                          type="radio"
                          name="proprietaire"
                          checked={checked}
                          onChange={() => setOwnerId(offer.profile.id)}
                          className="h-5 w-5 accent-current text-primary"
                        />
                        <Avatar
                          name={personName(offer.profile)}
                          url={offer.profile.avatar_url}
                          size={34}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {personName(offer.profile)}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            {offer.via === "ami" ? "Ami·e" : "Membre de votre communauté"}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
              <Avatar
                name={personName(available[0].profile)}
                url={available[0].profile.avatar_url}
                size={34}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {personName(available[0].profile)}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {available[0].via === "ami" ? "Ami·e" : "Membre de votre communauté"}
                </span>
              </span>
            </div>
          )}

          <Field
            label="Retour souhaité pour le (facultatif)"
            htmlFor="loan-due"
          >
            <Input
              id="loan-due"
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          <Field label="Un mot (facultatif)" htmlFor="loan-message">
            <Textarea
              id="loan-message"
              value={message}
              maxLength={500}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Salut ! Je peux te l'emprunter ?"
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
              disabled={pending || !ownerId}
              className="flex-1"
            >
              {pending ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

export default LoanRequestDialog;
