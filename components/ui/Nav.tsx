"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  IconBooks,
  IconCompass,
  IconHandshake,
  IconHome,
  IconUsers,
} from "./Icons";

const TABS = [
  { href: "/", label: "Accueil", Icon: IconHome },
  { href: "/decouvrir", label: "Découvrir", Icon: IconCompass },
  { href: "/bibliotheque", label: "Ma biblio", Icon: IconBooks },
  { href: "/amis", label: "Amis", Icon: IconUsers },
  { href: "/emprunts", label: "Emprunts", Icon: IconHandshake },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Barre d'onglets basse : la navigation principale sur mobile. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[58px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition",
                  active ? "text-primary" : "text-ink-faint",
                )}
              >
                <Icon className={cn("h-6 w-6", active && "drop-shadow-[0_0_6px_var(--bc-accent)]")} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Navigation latérale sur écran large. */
export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="hidden md:block">
      <ul className="sticky top-24 space-y-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-ink-soft hover:bg-surface-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
