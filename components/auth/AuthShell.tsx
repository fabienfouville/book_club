import Link from "next/link";
import type { ReactNode } from "react";

/** Cadre commun aux écrans de compte : une carte centrée, lisible au pouce. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md py-6 sm:py-10">
      <div className="mb-6 text-center">
        <span
          aria-hidden
          className="bc-gradient mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-2xl shadow-tiny"
        >
          📚
        </span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>
        ) : null}
      </div>

      <div className="bc-card p-5 sm:p-6">{children}</div>

      {footer ? (
        <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div>
      ) : null}
    </div>
  );
}

export function AuthFooterLink({
  href,
  label,
  cta,
}: {
  href: string;
  label: string;
  cta: string;
}) {
  return (
    <p>
      {label}{" "}
      <Link
        href={href}
        className="font-semibold text-primary underline-offset-4 hover:underline"
      >
        {cta}
      </Link>
    </p>
  );
}
