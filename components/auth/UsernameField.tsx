"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { checkUsernameAvailability } from "@/lib/auth/actions";
import {
  USERNAME_MAX,
  normalizeUsername,
  validateUsername,
} from "@/lib/auth/validation";

type Status = "idle" | "checking" | "free" | "taken" | "invalid";

/**
 * Champ pseudo avec vérification en direct contre la table `profiles`.
 * La saisie est normalisée à la frappe : ce que l'on voit est ce qui sera
 * enregistré, et ce qui apparaîtra dans l'adresse du profil.
 */
export function UsernameField({
  defaultValue = "",
  serverError,
  initialUsername,
  onChangeValue,
}: {
  defaultValue?: string;
  serverError?: string;
  /** Pseudo actuel : inutile de le signaler « déjà pris » à son propriétaire. */
  initialUsername?: string;
  onChangeValue?: (value: string, available: boolean) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(normalizeUsername(defaultValue));
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const current = value;
    if (!current) {
      setStatus("idle");
      setMessage(null);
      onChangeValue?.(current, false);
      return;
    }

    const invalid = validateUsername(current);
    if (invalid) {
      setStatus("invalid");
      setMessage(invalid);
      onChangeValue?.(current, false);
      return;
    }

    if (initialUsername && current === initialUsername) {
      setStatus("free");
      setMessage("C'est votre pseudo actuel.");
      onChangeValue?.(current, true);
      return;
    }

    setStatus("checking");
    setMessage(null);
    const ticket = ++latest.current;
    // Anti-rebond : on interroge la base une fois la frappe posée.
    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailability(current);
      if (ticket !== latest.current) return;
      if (result.error) {
        setStatus("taken");
        setMessage(result.error);
        onChangeValue?.(current, false);
      } else {
        setStatus("free");
        setMessage("Ce pseudo est libre.");
        onChangeValue?.(current, true);
      }
    }, 450);

    return () => clearTimeout(timer);
    // `onChangeValue` est volontairement hors dépendances : il change à
    // chaque rendu du parent et relancerait la vérification sans fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, initialUsername]);

  const tone =
    status === "free"
      ? "text-success"
      : status === "taken" || status === "invalid"
        ? "text-danger"
        : "text-ink-faint";

  return (
    <Field
      label="Pseudo"
      htmlFor={id}
      hint="Lettres, chiffres et tirets bas. Il apparaîtra dans l'adresse de votre profil."
      error={serverError}
    >
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-ink-faint"
        >
          @
        </span>
        <Input
          id={id}
          name="username"
          value={value}
          onChange={(e) => setValue(normalizeUsername(e.target.value))}
          autoComplete="username"
          inputMode="text"
          maxLength={USERNAME_MAX}
          required
          aria-describedby={`${id}-etat`}
          className="pl-8"
          placeholder="marie_lit"
        />
      </div>
      <p id={`${id}-etat`} aria-live="polite" className={`text-xs ${tone}`}>
        {status === "checking"
          ? "Vérification…"
          : (message ?? " ")}
      </p>
    </Field>
  );
}
