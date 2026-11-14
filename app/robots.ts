import type { MetadataRoute } from "next";

/**
 * Les robots d'indexation n'ont accès qu'à l'accueil et aux fiches livres.
 * Sans cette règle, ils exploraient /decouvrir dans toutes ses combinaisons
 * de filtres (genres × tri × pages), soit des milliers d'URL calculées par le
 * serveur : c'est ce qui a épuisé le quota d'invocations de l'hébergeur.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/decouvrir",
        "/api/",
        "/auth/",
        "/amis",
        "/bibliotheque",
        "/emprunts",
        "/communaute",
        "/profil",
        "/reglages",
        "/bienvenue",
        "/connexion",
        "/inscription",
      ],
    },
  };
}
