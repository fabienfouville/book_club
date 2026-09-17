"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { updateLoanStatus } from "@/app/emprunts/actions";
import type { LoanStatus } from "@/types/database";

/** Boutons d'action disponibles selon le statut de la demande et le rôle. */
export function LoanActions({
  loanId,
  status,
  role,
}: {
  loanId: string;
  status: LoanStatus;
  role: "owner" | "borrower";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(next: LoanStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateLoanStatus(loanId, next);
      if (!result.ok) setError(result.error);
    });
  }

  const actions: Array<{ label: string; next: LoanStatus; variant?: "primary" | "secondary" | "danger" }> = [];

  if (role === "owner" && status === "pending") {
    actions.push({ label: "Accepter", next: "accepted" });
    actions.push({ label: "Refuser", next: "declined", variant: "danger" });
  }
  if (role === "owner" && status === "accepted") {
    actions.push({ label: "Marquer prêté", next: "borrowed" });
  }
  if (role === "owner" && (status === "accepted" || status === "borrowed")) {
    actions.push({ label: "Marquer rendu", next: "returned" });
  }
  if (role === "borrower" && status === "pending") {
    actions.push({ label: "Annuler", next: "cancelled", variant: "secondary" });
  }

  if (actions.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.next}
            type="button"
            size="sm"
            variant={action.variant ?? "primary"}
            disabled={pending}
            onClick={() => go(action.next)}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default LoanActions;
