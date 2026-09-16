import { cn } from "@/lib/cn";

/**
 * Couverture d'un livre. Si l'éditeur n'en fournit pas, on dessine une
 * couverture de repli au dégradé dérivé du titre : jamais de trou visuel.
 */
export function BookCover({
  title,
  authors,
  url,
  className,
  sizes = "(max-width: 640px) 45vw, 180px",
  priority,
}: {
  title: string;
  authors?: string[];
  url?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={`Couverture de ${title}`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        sizes={sizes}
        className={cn(
          "aspect-2/3 w-full rounded-xl border border-border object-cover",
          className,
        )}
      />
    );
  }

  const hue = [...title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      role="img"
      aria-label={`Couverture de ${title}`}
      className={cn(
        "aspect-2/3 w-full overflow-hidden rounded-xl border border-border p-3",
        "flex flex-col justify-end text-white",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(150deg, hsl(${hue} 62% 38%), hsl(${(hue + 40) % 360} 74% 55%))`,
      }}
    >
      <span className="font-display text-sm font-bold leading-tight line-clamp-2-safe">
        {title}
      </span>
      {authors?.length ? (
        <span className="mt-1 text-[11px] opacity-80">{authors[0]}</span>
      ) : null}
    </div>
  );
}
