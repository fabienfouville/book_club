import { cn } from "@/lib/cn";

/**
 * Encart de mode démonstration. Il apparaît partout où une action serait
 * normalement enregistrée : le site fonctionne, mais rien n'est conservé tant
 * que Supabase n'est pas branché.
 */
export function DemoNotice({
  titre = "Vous êtes en mode démonstration",
  description = "Bookclub tourne ici sur un catalogue de démarrage, sans base de données. Vous pouvez tout regarder et tout parcourir, mais vos notes, vos avis et votre bibliothèque ne seront pas enregistrés tant que Supabase n'est pas connecté.",
  className,
}: {
  titre?: string;
  description?: string;
  className?: string;
}) {
  return (
    <aside
      aria-label="Mode démonstration"
      className={cn(
        "rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm text-ink",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <span aria-hidden className="text-base">
          ✨
        </span>
        {titre}
      </p>
      <p className="mt-1 text-ink-soft">{description}</p>
    </aside>
  );
}

export default DemoNotice;
