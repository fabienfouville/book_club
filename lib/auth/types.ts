/** État renvoyé par les Server Actions d'authentification à `useActionState`. */
export type AuthFormState = {
  /** `sent` = e-mail parti, `ok` = action réussie sans redirection. */
  status: "idle" | "error" | "sent" | "ok";
  message?: string;
  /** Erreurs champ par champ, clé = attribut `name` de l'input. */
  fieldErrors?: Record<string, string>;
};

export const IDLE_STATE: AuthFormState = { status: "idle" };
