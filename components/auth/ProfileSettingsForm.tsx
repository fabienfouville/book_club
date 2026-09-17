"use client";

import { useActionState, useId, useState } from "react";
import { updateProfileAction } from "@/app/reglages/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SectionTitle } from "@/components/ui/Card";
import { FormMessage } from "./FormMessage";
import { GenrePicker } from "./GenrePicker";
import { IDLE_STATE } from "@/lib/auth/types";
import { BIO_MAX, DISPLAY_NAME_MAX } from "@/lib/auth/validation";
import type { Profile } from "@/types/database";

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const nameId = useId();
  const bioId = useId();
  const avatarId = useId();
  const publicId = useId();

  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    IDLE_STATE,
  );
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [isPublic, setIsPublic] = useState(profile.is_public);

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "ok" && state.message ? (
        <FormMessage tone="success">{state.message}</FormMessage>
      ) : null}

      <div className="flex items-center gap-3">
        <Avatar
          name={displayName || profile.username}
          url={avatarUrl || null}
          size={56}
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {displayName || profile.username}
          </p>
          <p className="truncate text-sm text-ink-soft">@{profile.username}</p>
        </div>
      </div>

      <Field
        label="Nom affiché"
        htmlFor={nameId}
        hint="Le nom que verront les autres membres."
        error={state.fieldErrors?.display_name}
      >
        <Input
          id={nameId}
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
        />
      </Field>

      <Field
        label="Bio"
        htmlFor={bioId}
        hint={`${bio.length} / ${BIO_MAX} caractères.`}
        error={state.fieldErrors?.bio}
      >
        <Textarea
          id={bioId}
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_MAX}
          placeholder="Trois lignes sur vos lectures, vos manies, vos coups de cœur."
        />
      </Field>

      <Field
        label="Adresse de l'avatar"
        htmlFor={avatarId}
        hint="Facultatif : lien https vers une image. Sans image, vos initiales s'affichent."
        error={state.fieldErrors?.avatar_url}
      >
        <Input
          id={avatarId}
          name="avatar_url"
          type="url"
          inputMode="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <div className="space-y-2">
        <SectionTitle
          title="Genres préférés"
          subtitle="Ils nourrissent vos recommandations."
        />
        <GenrePicker defaultValue={profile.favorite_genres ?? []} />
      </div>

      <div className="rounded-xl border border-border-strong bg-surface-muted p-4">
        <label
          htmlFor={publicId}
          className="flex min-h-[44px] items-center justify-between gap-4"
        >
          <span>
            <span className="block font-semibold">Profil public</span>
            <span className="block text-sm text-ink-soft">
              {isPublic
                ? "Tout le monde peut voir votre profil et vos étagères."
                : "Seuls vos amis et les membres de vos communautés vous voient."}
            </span>
          </span>
          <input
            id={publicId}
            name="is_public"
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-[var(--bc-primary)]"
          />
        </label>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
