import Link from "next/link";
import { Avatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";
import { IconSearch } from "./Icons";
import { ButtonLink } from "./Button";

export function TopBar({
  username,
  displayName,
  avatarUrl,
}: {
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Bookclub, accueil">
          <span
            aria-hidden
            className="bc-gradient grid h-9 w-9 place-items-center rounded-xl text-lg shadow-tiny"
          >
            📚
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            <span className="bc-gradient-text">Book</span>
            <span className="text-ink">club</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/decouvrir"
            aria-label="Rechercher un livre"
            className="grid h-11 w-11 place-items-center rounded-full border border-border-strong bg-surface text-ink-soft transition hover:bg-surface-muted"
          >
            <IconSearch className="h-5 w-5" />
          </Link>
          <ThemeToggle />
          {username ? (
            <Link
              href={`/profil/${username}`}
              aria-label="Mon profil"
              className="rounded-full ring-2 ring-transparent transition hover:ring-primary"
            >
              <Avatar name={displayName || username} url={avatarUrl} size={40} />
            </Link>
          ) : (
            <ButtonLink href="/connexion" size="sm">
              Connexion
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
