"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

function Star({ fill, className }: { fill: number; className?: string }) {
  // `fill` va de 0 à 1 : permet les demi-étoiles sur les moyennes.
  const id = `g${Math.random().toString(36).slice(2, 9)}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-full w-full", className)}>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="currentColor" />
          <stop offset={`${fill * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45l-5.81 3.05L7.3 14.03 2.6 9.45l6.5-.95L12 2.6z"
        fill={`url(#${id})`}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Affichage seul d'une note moyenne. */
export function StarsDisplay({
  value,
  size = 16,
  count,
}: {
  value: number | null;
  size?: number;
  count?: number;
}) {
  const v = value ?? 0;
  return (
    <span className="inline-flex items-center gap-1 text-gold">
      <span className="inline-flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ width: size, height: size }}>
            <Star fill={Math.min(1, Math.max(0, v - i))} />
          </span>
        ))}
      </span>
      <span className="sr-only">
        {value ? `${value.toFixed(1)} sur 5` : "Pas encore noté"}
      </span>
      {value ? (
        <span className="text-xs font-semibold text-ink-soft">
          {value.toFixed(1)}
          {count !== undefined ? ` (${count})` : ""}
        </span>
      ) : (
        <span className="text-xs text-ink-faint">—</span>
      )}
    </span>
  );
}

/** Notation tactile : 5 cibles larges, réglables au pouce. */
export function StarsInput({
  value,
  onChange,
  disabled,
  size = 34,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div
      className="inline-flex items-center gap-1"
      role="radiogroup"
      aria-label="Votre note"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onClick={() => onChange(n)}
          className={cn(
            "grid place-items-center rounded-lg p-1 transition disabled:opacity-50",
            "hover:bg-primary-soft",
          )}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <span style={{ width: size, height: size }} className={n <= shown ? "text-gold" : "text-ink-faint"}>
            <Star fill={n <= shown ? 1 : 0} />
          </span>
        </button>
      ))}
    </div>
  );
}
