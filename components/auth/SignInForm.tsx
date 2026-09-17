"use client";

import { useActionState, useId, useState } from "react";
import {
  signInWithMagicLinkAction,
  signInWithPasswordAction,
} from "@/app/connexion/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { FormMessage } from "./FormMessage";
import { PasswordField } from "./PasswordField";
import { IDLE_STATE } from "@/lib/auth/types";
import { validateEmail } from "@/lib/auth/validation";

type Mode = "password" | "magic";

const TABS: Array<{ id: Mode; label: string }> = [
  { id: "password", label: "Mot de passe" },
  { id: "magic", label: "Lien magique" },
];

export function SignInForm({
  suite,
  initialError,
}: {
  suite: string;
  initialError?: string;
}) {
  const base = useId();
  const [mode, setMode] = useState<Mode>("password");

  return (
    <div className="space-y-5">
      {initialError ? <FormMessage tone="error">{initialError}</FormMessage> : null}

      <div
        role="tablist"
        aria-label="Méthode de connexion"
        className="flex gap-1 rounded-full border border-border bg-surface-muted p-1"
      >
        {TABS.map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${base}-onglet-${tab.id}`}
              aria-selected={active}
              aria-controls={`${base}-panneau-${tab.id}`}
              onClick={() => setMode(tab.id)}
              className={cn(
                "min-h-[44px] flex-1 rounded-full px-3 text-sm font-semibold transition",
                active
                  ? "bc-gradient text-white shadow-tiny"
                  : "text-ink-soft hover:bg-surface",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${base}-panneau-password`}
        aria-labelledby={`${base}-onglet-password`}
        hidden={mode !== "password"}
      >
        <PasswordPanel suite={suite} />
      </div>

      <div
        role="tabpanel"
        id={`${base}-panneau-magic`}
        aria-labelledby={`${base}-onglet-magic`}
        hidden={mode !== "magic"}
      >
        <MagicPanel suite={suite} />
      </div>
    </div>
  );
}

function PasswordPanel({ suite }: { suite: string }) {
  const emailId = useId();
  const [state, formAction, pending] = useActionState(
    signInWithPasswordAction,
    IDLE_STATE,
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const errors = { ...clientErrors, ...(state.fieldErrors ?? {}) };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const found: Record<string, string> = {};
    const email = validateEmail(String(data.get("email") ?? ""));
    if (email) found.email = email;
    if (!String(data.get("password") ?? ""))
      found.password = "Saisissez votre mot de passe.";
    setClientErrors(found);
    if (Object.keys(found).length > 0) event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-4">
      <input type="hidden" name="suite" value={suite} />

      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <Field label="Adresse e-mail" htmlFor={emailId} error={errors.email}>
        <Input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          required
        />
      </Field>

      <PasswordField
        autoComplete="current-password"
        serverError={errors.password}
      />

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

function MagicPanel({ suite }: { suite: string }) {
  const emailId = useId();
  const [state, formAction, pending] = useActionState(
    signInWithMagicLinkAction,
    IDLE_STATE,
  );
  const [clientError, setClientError] = useState<string | undefined>();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const email = validateEmail(String(data.get("email") ?? ""));
    setClientError(email ?? undefined);
    if (email) event.preventDefault();
  }

  if (state.status === "sent") {
    return <FormMessage tone="success">{state.message}</FormMessage>;
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-4">
      <input type="hidden" name="suite" value={suite} />

      <p className="text-sm text-ink-soft">
        Pas envie de retenir un mot de passe ? Nous vous envoyons un lien de
        connexion valable une heure.
      </p>

      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <Field
        label="Adresse e-mail"
        htmlFor={emailId}
        error={state.fieldErrors?.email ?? clientError}
      >
        <Input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          required
        />
      </Field>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Envoi…" : "Recevoir un lien de connexion"}
      </Button>
    </form>
  );
}
