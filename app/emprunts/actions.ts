"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoanRequest, LoanStatus, NotificationKind } from "@/types/database";
import { cleanText, isUuid, requireSession } from "@/lib/social/guard";
import { notify } from "@/lib/social/notify";
import {
  BLOCKING_LOAN_STATUSES,
  PROFILE_FIELDS,
  getSocialCircle,
  personName,
} from "@/lib/social/queries";
import type { ActionResult, ProfileLite } from "@/lib/social/types";

const MESSAGE_MAX = 500;

/** Statuts encore « vivants » : on n'ouvre pas deux fois la même demande. */
const OPEN_STATUSES: LoanStatus[] = ["pending", "accepted", "borrowed"];

/** Qui peut passer de quel statut à quel autre. */
const TRANSITIONS: Record<
  Exclude<LoanStatus, "pending">,
  { from: LoanStatus[]; by: "owner" | "borrower" }
> = {
  accepted: { from: ["pending"], by: "owner" },
  declined: { from: ["pending"], by: "owner" },
  borrowed: { from: ["accepted"], by: "owner" },
  returned: { from: ["borrowed", "accepted"], by: "owner" },
  cancelled: { from: ["pending"], by: "borrower" },
};

const NOTIFICATION_BY_STATUS: Record<
  Exclude<LoanStatus, "pending">,
  NotificationKind
> = {
  accepted: "loan_accepted",
  borrowed: "loan_accepted",
  declined: "loan_declined",
  cancelled: "loan_declined",
  returned: "loan_returned",
};

function refreshLoanPages() {
  revalidatePath("/emprunts");
  revalidatePath("/amis/[username]", "page");
  revalidatePath("/communaute/[slug]", "page");
  revalidatePath("/livre/[id]", "page");
}

async function loadProfile(
  supabase: SupabaseClient,
  id: string,
): Promise<ProfileLite | null> {
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return (data as ProfileLite | null) ?? null;
}

/** Un exemplaire déjà promis ou prêté ne peut pas repartir ailleurs. */
async function copyIsBusy(
  supabase: SupabaseClient,
  bookId: string,
  ownerId: string,
  exceptId?: string,
): Promise<boolean> {
  let request = supabase
    .from("loan_requests")
    .select("id")
    .eq("book_id", bookId)
    .eq("owner_id", ownerId)
    .in("status", [...BLOCKING_LOAN_STATUSES]);
  if (exceptId) request = request.neq("id", exceptId);
  const { data } = await request.limit(1);
  return ((data ?? []) as Array<{ id: string }>).length > 0;
}

/** Crée une demande d'emprunt auprès d'un propriétaire de mon cercle. */
export async function requestLoan(input: {
  bookId: string;
  ownerId: string;
  message?: string;
  dueAt?: string;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { supabase, userId } = session;

  if (!isUuid(input?.bookId)) return { ok: false, error: "Livre introuvable." };
  if (!isUuid(input?.ownerId))
    return { ok: false, error: "Propriétaire introuvable." };
  if (input.ownerId === userId)
    return { ok: false, error: "Ce livre est déjà le vôtre." };

  const dueAt = cleanText(input?.dueAt, 10);
  if (dueAt && !/^\d{4}-\d{2}-\d{2}$/.test(dueAt))
    return { ok: false, error: "La date de retour souhaitée n'est pas valide." };

  const circle = await getSocialCircle(supabase, userId);
  if (!circle.allIds.includes(input.ownerId))
    return {
      ok: false,
      error:
        "Vous ne pouvez emprunter qu'à vos amis ou aux membres de vos communautés.",
    };

  const { data: item } = await supabase
    .from("library_items")
    .select("user_id, is_owned, is_lendable")
    .eq("book_id", input.bookId)
    .eq("user_id", input.ownerId)
    .maybeSingle();
  const copy = item as { is_owned: boolean; is_lendable: boolean } | null;
  if (!copy?.is_owned || !copy.is_lendable)
    return { ok: false, error: "Cette personne ne prête pas ce livre." };

  if (await copyIsBusy(supabase, input.bookId, input.ownerId))
    return {
      ok: false,
      error: "Cet exemplaire est déjà promis ou prêté à quelqu'un d'autre.",
    };

  const { data: mine } = await supabase
    .from("loan_requests")
    .select("id, status")
    .eq("book_id", input.bookId)
    .eq("owner_id", input.ownerId)
    .eq("borrower_id", userId)
    .in("status", OPEN_STATUSES)
    .limit(1);
  if (((mine ?? []) as Array<{ id: string }>).length > 0)
    return { ok: false, error: "Vous avez déjà une demande en cours pour ce livre." };

  const { error } = await supabase.from("loan_requests").insert({
    book_id: input.bookId,
    owner_id: input.ownerId,
    borrower_id: userId,
    status: "pending",
    message: cleanText(input?.message, MESSAGE_MAX),
    due_at: dueAt,
  });
  if (error) return { ok: false, error: "L'envoi de la demande a échoué." };

  const me = await loadProfile(supabase, userId);
  await notify(supabase, [
    {
      user_id: input.ownerId,
      kind: "loan_requested",
      payload: {
        from_user: userId,
        username: me?.username ?? null,
        name: personName(me),
        book_id: input.bookId,
        due_at: dueAt,
      },
    },
  ]);

  refreshLoanPages();
  return { ok: true };
}

/**
 * Fait avancer une demande dans son cycle de vie :
 * `pending → accepted → borrowed → returned`, plus `declined` et `cancelled`.
 */
export async function updateLoanStatus(
  loanId: string,
  next: LoanStatus,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { supabase, userId } = session;

  if (!isUuid(loanId)) return { ok: false, error: "Demande introuvable." };
  if (next === "pending" || !(next in TRANSITIONS))
    return { ok: false, error: "Changement de statut impossible." };

  const rule = TRANSITIONS[next as Exclude<LoanStatus, "pending">];

  const { data } = await supabase
    .from("loan_requests")
    .select("*")
    .eq("id", loanId)
    .maybeSingle();
  const loan = (data as LoanRequest | null) ?? null;
  if (!loan) return { ok: false, error: "Cette demande n'existe plus." };

  const isOwner = loan.owner_id === userId;
  const isBorrower = loan.borrower_id === userId;
  if (!isOwner && !isBorrower)
    return { ok: false, error: "Cette demande ne vous concerne pas." };

  if (rule.by === "owner" && !isOwner)
    return { ok: false, error: "Seul le propriétaire du livre peut faire cela." };
  if (rule.by === "borrower" && !isBorrower)
    return { ok: false, error: "Seul l'emprunteur peut annuler sa demande." };

  if (!rule.from.includes(loan.status))
    return {
      ok: false,
      error: `Impossible depuis le statut actuel de la demande.`,
    };

  // Un exemplaire déjà engagé ne peut pas être promis une seconde fois.
  if (
    (next === "accepted" || next === "borrowed") &&
    (await copyIsBusy(supabase, loan.book_id, loan.owner_id, loan.id))
  )
    return {
      ok: false,
      error: "Cet exemplaire est déjà promis ou prêté à quelqu'un d'autre.",
    };

  const { error } = await supabase
    .from("loan_requests")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", loanId);
  if (error) return { ok: false, error: "La mise à jour a échoué." };

  const me = await loadProfile(supabase, userId);
  const recipient = isOwner ? loan.borrower_id : loan.owner_id;
  await notify(supabase, [
    {
      user_id: recipient,
      kind: NOTIFICATION_BY_STATUS[next as Exclude<LoanStatus, "pending">],
      payload: {
        from_user: userId,
        username: me?.username ?? null,
        name: personName(me),
        book_id: loan.book_id,
        loan_id: loan.id,
        status: next,
      },
    },
  ]);

  refreshLoanPages();
  return { ok: true };
}
