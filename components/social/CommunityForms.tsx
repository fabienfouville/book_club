"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { createCommunity, joinCommunityByCode } from "@/app/communaute/actions";

/** Créer une communauté : nom, description, ouverte ou sur invitation. */
export function CreateCommunityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCommunity({
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        isOpen: formData.get("is_open") === "on",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/communaute/${result.slug}`);
    });
  }

  return (
    <form action={submit} className="bc-card space-y-4 p-4">
      <h2 className="font-display text-base font-bold">Créer une communauté</h2>
      <Field label="Nom" htmlFor="community-name">
        <Input id="community-name" name="name" required maxLength={80} placeholder="Le club de lecture du mardi" />
      </Field>
      <Field label="Description (facultatif)" htmlFor="community-description">
        <Textarea id="community-description" name="description" maxLength={400} />
      </Field>
      <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="is_open" className="h-5 w-5 accent-current text-primary" />
        Visible et rejoignable par tous, sans code d&apos;invitation
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Création…" : "Créer la communauté"}
      </Button>
    </form>
  );
}

/** Rejoindre une communauté grâce à un code d'invitation. */
export function JoinCommunityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await joinCommunityByCode(String(formData.get("code") ?? ""));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/communaute/${result.slug}`);
    });
  }

  return (
    <form action={submit} className="bc-card space-y-3 p-4">
      <h2 className="font-display text-base font-bold">Rejoindre avec un code</h2>
      <div className="flex gap-2">
        <Input
          name="code"
          required
          placeholder="Ex. K7M2P9QX"
          aria-label="Code d'invitation"
          className="flex-1 uppercase tracking-wider"
        />
        <Button type="submit" disabled={pending} variant="secondary">
          {pending ? "…" : "Rejoindre"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
