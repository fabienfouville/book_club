"use client";

import { useId, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { PASSWORD_MIN, passwordStrength } from "@/lib/auth/validation";

const TONE_BG = {
  danger: "bg-danger",
  accent: "bg-accent",
  gold: "bg-gold",
  success: "bg-success",
} as const;

const TONE_TEXT = {
  danger: "text-danger",
  accent: "text-accent",
  gold: "text-gold",
  success: "text-success",
} as const;

/** Champ mot de passe : affichage optionnel en clair et jauge de force. */
export function PasswordField({
  label = "Mot de passe",
  name = "password",
  autoComplete = "new-password",
  serverError,
  withStrength = false,
  hint,
}: {
  label?: string;
  name?: string;
  autoComplete?: "new-password" | "current-password";
  serverError?: string;
  withStrength?: boolean;
  hint?: string;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const strength = passwordStrength(value);

  return (
    <Field
      label={label}
      htmlFor={id}
      error={serverError}
      hint={hint ?? (withStrength ? `Au moins ${PASSWORD_MIN} caractères.` : undefined)}
    >
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={autoComplete}
          minLength={withStrength ? PASSWORD_MIN : undefined}
          required
          className="pr-[5.5rem]"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          className="absolute right-1 top-1/2 h-11 -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-primary hover:bg-primary-soft"
        >
          {shown ? "Masquer" : "Afficher"}
        </button>
      </div>

      {withStrength && value ? (
        <div className="flex items-center gap-2 pt-0.5">
          <span className="flex h-1.5 flex-1 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-full flex-1 rounded-full transition",
                  step <= strength.score
                    ? TONE_BG[strength.tone]
                    : "bg-surface-muted",
                )}
              />
            ))}
          </span>
          <span
            aria-live="polite"
            className={cn("text-xs font-semibold", TONE_TEXT[strength.tone])}
          >
            {strength.label}
          </span>
        </div>
      ) : null}
    </Field>
  );
}
