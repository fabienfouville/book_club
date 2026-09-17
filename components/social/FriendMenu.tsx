"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconPlus } from "@/components/ui/Icons";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/app/amis/actions";
import type { ActionResult, FriendState } from "@/lib/social/types";

type Size = "sm" | "md" | "lg";

/** Partie interactive de `FriendButton` : l'état est résolu côté serveur. */
export function FriendMenu({
  profileId,
  username,
  state,
  size = "md",
  className,
}: {
  profileId: string;
  username: string;
  state: FriendState;
  size?: Size;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else setOpen(false);
    });
  }

  if (state === "self" || state === "blocked") return null;

  const message = error ? (
    <p role="alert" className="mt-1 text-xs text-danger">
      {error}
    </p>
  ) : null;

  if (state === "none") {
    return (
      <div className={className}>
        <Button
          size={size}
          disabled={pending}
          aria-label={`Ajouter ${username} en ami`}
          onClick={() => run(() => sendFriendRequest(profileId))}
        >
          <IconPlus className="h-4 w-4" aria-hidden />
          Ajouter en ami
        </Button>
        {message}
      </div>
    );
  }

  if (state === "received") {
    return (
      <div className={className}>
        <div className="flex flex-wrap gap-2">
          <Button
            size={size}
            disabled={pending}
            aria-label={`Accepter la demande de ${username}`}
            onClick={() => run(() => acceptFriendRequest(profileId))}
          >
            Accepter
          </Button>
          <Button
            size={size}
            variant="ghost"
            disabled={pending}
            aria-label={`Refuser la demande de ${username}`}
            onClick={() => run(() => declineFriendRequest(profileId))}
          >
            Refuser
          </Button>
        </div>
        {message}
      </div>
    );
  }

  const isFriend = state === "friends";

  return (
    <div className={className}>
      <div ref={boxRef} className="relative">
        <Button
          size={size}
          variant="secondary"
          disabled={pending}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={
            isFriend
              ? `Vous êtes amis avec ${username} — ouvrir les options`
              : `Demande envoyée à ${username} — ouvrir les options`
          }
          onClick={() => setOpen((v) => !v)}
        >
          {isFriend ? (
            <>
              <IconCheck className="h-4 w-4" aria-hidden />
              Amis
            </>
          ) : (
            "Demande envoyée"
          )}
        </Button>

        {open ? (
          <div
            role="menu"
            aria-label={`Options pour ${username}`}
            className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border-strong bg-surface p-1 shadow-soft"
          >
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() =>
                run(() =>
                  isFriend
                    ? removeFriend(profileId)
                    : cancelFriendRequest(profileId),
                )
              }
              className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-danger transition hover:bg-surface-muted disabled:opacity-50"
            >
              {isFriend ? "Retirer de mes amis" : "Annuler la demande"}
            </button>
          </div>
        ) : null}
      </div>
      {message}
    </div>
  );
}
