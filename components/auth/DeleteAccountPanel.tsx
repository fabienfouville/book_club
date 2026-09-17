"use client";

import { useActionState, useId, useState } from "react";
import { deleteAccountAction } from "@/app/reglages/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "./FormMessage";
import { IDLE_STATE } from "@/lib/auth/types";

/**
 * Suppression de compte : jamais en un clic. Il faut ouvrir le panneau puis
 * recopier un mot, car l'opération efface aussi étagères, notes et avis.
 */
export function DeleteAccountPanel() {
  const inputId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    IDLE_STATE,
  );

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="min-h-[44px] text-sm font-semibold text-danger underline-offset-4 hover:underline"
      >
        Supprimer mon compte
      </button>

      <div id={panelId} hidden={!open}>
        <form
          action={formAction}
          className="space-y-4 rounded-xl border border-danger bg-surface-muted p-4"
        >
          <p className="text-sm text-ink">
            Cette action est définitive. Votre profil, vos étagères, vos notes,
            vos avis et vos demandes d&apos;emprunt seront effacés. Les livres
            que vous avez ajoutés au catalogue restent disponibles pour les
            autres membres.
          </p>

          {state.status === "error" && state.message ? (
            <FormMessage tone="error">{state.message}</FormMessage>
          ) : null}

          <Field
            label="Tapez SUPPRIMER pour confirmer"
            htmlFor={inputId}
            error={state.fieldErrors?.confirmation}
          >
            <Input
              id={inputId}
              name="confirmation"
              autoComplete="off"
              placeholder="SUPPRIMER"
              required
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
