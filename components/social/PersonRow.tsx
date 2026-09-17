import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { personName } from "@/lib/social/queries";
import type { ProfileLite } from "@/lib/social/types";
import { cn } from "@/lib/cn";

/** Ligne « membre » : avatar, nom, pseudo, et des actions à droite. */
export function PersonRow({
  profile,
  href,
  subtitle,
  actions,
  className,
}: {
  profile: ProfileLite;
  href?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const name = personName(profile);
  const identity = (
    <>
      <Avatar name={name} url={profile.avatar_url} size={44} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{name}</span>
        <span className="block truncate text-xs text-ink-soft">
          @{profile.username}
        </span>
      </span>
    </>
  );

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5",
        className,
      )}
    >
      {href ? (
        <Link
          href={href}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:text-primary"
        >
          {identity}
        </Link>
      ) : (
        <span className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3">
          {identity}
        </span>
      )}
      {subtitle ? (
        <span className="w-full text-xs text-ink-faint sm:w-auto">{subtitle}</span>
      ) : null}
      {actions ? (
        <span className="flex flex-wrap items-center gap-2">{actions}</span>
      ) : null}
    </li>
  );
}
