import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <div className="py-10">
      <EmptyState
        emoji="🔮"
        title="Cette page s'est volatilisée"
        description="Le grimoire ne contient rien à cette adresse. Retournez explorer le catalogue, il y a de quoi faire."
        actionLabel="Découvrir des livres"
        actionHref="/decouvrir"
      />
    </div>
  );
}
