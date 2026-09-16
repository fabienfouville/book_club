import { cn } from "@/lib/cn";

/** Pastille d'initiale, dégradé dérivé du pseudo : pas d'image à héberger. */
export function Avatar({
  name,
  url,
  size = 40,
  className,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "??";
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 72% 55%), hsl(${(hue + 48) % 360} 82% 62%))`,
      }}
    >
      {initials}
    </span>
  );
}
