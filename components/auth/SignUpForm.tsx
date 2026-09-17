"use client";

import { useActionState, useId, useState } from "react";
import { signUpAction } from "@/app/inscription/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "./FormMessage";
import { PasswordField } from "./PasswordField";
import { UsernameField } from "./UsernameField";
import { IDLE_STATE } from "@/lib/auth/types";
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth/validation";

export function SignUpForm({ suite }: { suite: string }) {
  const emailId = useId();
  const [state, formAction, pending] = useActionState(signUpAction, IDLE_STATE);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const errors = { ...clientErrors, ...(state.fieldErrors ?? {}) };

  // Validation côté client : on évite un aller-retour pour une faute évidente.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const found: Record<string, string> = {};
    const email = validateEmail(String(data.get("email") ?? ""));
    if (email) found.email = email;
    const password = validatePassword(String(data.get("password") ?? ""));
    if (password) found.password = password;
    const username = validateUsername(String(data.get("username") ?? ""));
    if (username) found.username = username;

    setClientErrors(found);
    if (Object.keys(found).length > 0) event.preventDefault();
  }

  if (state.status === "sent") {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">{state.message}</FormMessage>
        <p className="text-sm text-ink-soft">
          Rien reçu ? Regardez dans les indésirables, le message arrive parfois
          avec une minute de retard.
        </p>
      </div>
    );
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

      <UsernameField serverError={errors.username} />

      <PasswordField serverError={errors.password} withStrength />

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Création…" : "Créer mon compte"}
      </Button>

      <p className="text-center text-xs text-ink-faint">
        En créant un compte, vous acceptez que vos avis publics soient visibles
        par les autres membres.
      </p>
    </form>
  );
}
