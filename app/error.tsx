"use client";

import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bc-card mt-10 flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div aria-hidden className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-3xl">
        🌙
      </div>
      <h1 className="font-display text-lg font-bold">Un sortilège a mal tourné</h1>
      <p className="max-w-sm text-sm text-ink-soft">
        Une erreur inattendue s&apos;est produite. Réessayez : la plupart du temps,
        cela suffit.
      </p>
      {error.digest ? (
        <p className="text-xs text-ink-faint">Référence : {error.digest}</p>
      ) : null}
      <Button onClick={reset} className="mt-1">
        Réessayer
      </Button>
    </div>
  );
}
