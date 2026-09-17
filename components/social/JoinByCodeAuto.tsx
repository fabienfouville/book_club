"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { joinCommunityByCode } from "@/app/communaute/actions";

/** Rejoint automatiquement la communauté du code fourni dans l'URL. */
export function JoinByCodeAuto({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [tried, setTried] = useState(false);

  function go() {
    setError(null);
    setTried(true);
    startTransition(async () => {
      const result = await joinCommunityByCode(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/communaute/${result.slug}`);
    });
  }

  useEffect(() => {
    if (!tried) go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bc-card space-y-3 p-6 text-center">
      {pending ? (
        <p className="text-sm text-ink-soft">Connexion à la communauté…</p>
      ) : error ? (
        <>
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <Button type="button" onClick={go}>
            Réessayer
          </Button>
        </>
      ) : (
        <p className="text-sm text-ink-soft">Un instant…</p>
      )}
    </div>
  );
}
