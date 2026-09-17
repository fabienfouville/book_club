import { cn } from "@/lib/cn";

const TONES = {
  error: "border-danger bg-surface-muted text-ink",
  success: "border-success bg-surface-muted text-ink",
  info: "border-border-strong bg-primary-soft text-ink",
} as const;

const EMOJIS = { error: "⚠️", success: "✅", info: "💡" } as const;

/** Message de formulaire annoncé aux lecteurs d'écran dès son apparition. */
export function FormMessage({
  tone = "info",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm",
        TONES[tone],
      )}
    >
      <span aria-hidden>{EMOJIS[tone]}</span>
      <span>{children}</span>
    </p>
  );
}
