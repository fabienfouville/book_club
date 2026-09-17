"use client";

import { useActionState, useId, useState } from "react";
import { completeOnboardingAction } from "@/app/bienvenue/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { FormMessage } from "./FormMessage";
import { GenrePicker } from "./GenrePicker";
import { UsernameField } from "./UsernameField";
import { IDLE_STATE } from "@/lib/auth/types";
import { DISPLAY_NAME_MAX, validateUsername } from "@/lib/auth/validation";

const STEPS = ["Votre identité", "Vos genres", "C'est prêt"] as const;

export function OnboardingForm({
  defaultUsername = "",
  defaultDisplayName = "",
  defaultGenres = [],
  currentUsername,
}: {
  defaultUsername?: string;
  defaultDisplayName?: string;
  defaultGenres?: string[];
  /** Pseudo déjà enregistré, s'il y en a un (retour sur l'onboarding). */
  currentUsername?: string;
}) {
  const nameId = useId();
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    IDLE_STATE,
  );
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(defaultUsername);
  const [usernameOk, setUsernameOk] = useState(Boolean(defaultUsername));
  const [genresCount, setGenresCount] = useState(defaultGenres.length);
  const [stepError, setStepError] = useState<string | null>(null);

  function goNext() {
    if (step === 0) {
      const invalid = validateUsername(username);
      if (invalid) return setStepError(invalid);
      if (!usernameOk)
        return setStepError("Choisissez un pseudo disponible pour continuer.");
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Progression : trois étapes courtes, toutes sur la même page. */}
      <ol className="flex items-center gap-2" aria-label="Progression">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full transition",
                index <= step ? "bc-gradient" : "bg-surface-muted",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "text-[11px] font-semibold",
                index === step ? "text-primary" : "text-ink-faint",
              )}
              aria-current={index === step ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {stepError ? <FormMessage tone="error">{stepError}</FormMessage> : null}

      {/* Étape 1 — les champs restent montés : leur valeur part au final. */}
      <div hidden={step !== 0} className="space-y-4">
        <p className="text-sm text-ink-soft">
          Votre pseudo sert d&apos;adresse à votre profil. Le nom affiché est
          celui que vos amis verront.
        </p>

        <UsernameField
          defaultValue={defaultUsername}
          initialUsername={currentUsername}
          serverError={state.fieldErrors?.username}
          onChangeValue={(value, available) => {
            setUsername(value);
            setUsernameOk(available);
          }}
        />

        <Field
          label="Nom affiché"
          htmlFor={nameId}
          hint="Facultatif : à défaut, votre pseudo sera utilisé."
          error={state.fieldErrors?.display_name}
        >
          <Input
            id={nameId}
            name="display_name"
            defaultValue={defaultDisplayName}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="nickname"
            placeholder="Marie D."
          />
        </Field>
      </div>

      {/* Étape 2 */}
      <div hidden={step !== 1} className="space-y-4">
        <p className="text-sm text-ink-soft">
          Choisissez ce que vous aimez lire : les recommandations partiront de
          là. Vous pourrez changer d&apos;avis dans les réglages.
        </p>
        <GenrePicker
          defaultValue={defaultGenres}
          onChangeValue={(slugs) => setGenresCount(slugs.length)}
        />
      </div>

      {/* Étape 3 */}
      <div hidden={step !== 2} className="space-y-3 text-center">
        <span aria-hidden className="block text-4xl">
          ✨
        </span>
        <h2 className="font-display text-xl font-bold">
          Bienvenue dans le club, @{username || "vous"}
        </h2>
        <p className="text-sm text-ink-soft">
          {genresCount > 0
            ? `${genresCount} genre${genresCount > 1 ? "s" : ""} en poche : nous avons déjà des idées de lecture pour vous.`
            : "Ajoutez vos premiers livres, et les recommandations arriveront toutes seules."}
        </p>
        <p className="text-sm text-ink-soft">
          Notez vos lectures, écrivez vos avis, prêtez vos exemplaires à vos
          amis : tout commence maintenant.
        </p>
      </div>

      <div className="flex gap-2">
        {step > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              setStepError(null);
              setStep((s) => s - 1);
            }}
          >
            Retour
          </Button>
        ) : null}

        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" onClick={goNext} className="flex-1">
            Continuer
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={pending} className="flex-1">
            {pending ? "Un instant…" : "C'est parti"}
          </Button>
        )}
      </div>
    </form>
  );
}
