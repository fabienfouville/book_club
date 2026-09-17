import type { Metadata } from "next";
import { ManualBookForm } from "@/components/books/ManualBookForm";

export const metadata: Metadata = { title: "Ajouter un livre" };

export default function AjouterLivrePage() {
  return (
    <div className="space-y-4 py-4">
      <div>
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">
          Ajouter un livre
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Introuvable dans Open Library ou Google Books ? Ajoutez-le à la main,
          il rejoindra le catalogue partagé.
        </p>
      </div>
      <ManualBookForm />
    </div>
  );
}
