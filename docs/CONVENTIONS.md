# Conventions de développement — Bookclub

À lire avant toute contribution. Ces règles garantissent que des lots
développés en parallèle s'assemblent sans friction.

## Langue
- **Toute l'interface est en français** : libellés, messages d'erreur, états vides.
- Les commentaires de code sont en français, et n'expliquent que le *pourquoi*.
- Les identifiants de code (variables, fonctions, colonnes SQL) restent en anglais.
- Les segments d'URL sont en français : `/decouvrir`, `/bibliotheque`, `/emprunts`.

## Socle technique
- Next.js 15, App Router, **composants serveur par défaut**.
- `"use client"` uniquement quand il y a un état local ou un gestionnaire d'événement.
- Les mutations passent par des **Server Actions** (`"use server"`), jamais par
  des routes API, sauf pour la recherche externe de livres.
- TypeScript strict. Aucun `any` ; préférer `unknown` puis un affinage.

## Données
- Le contrat fait foi : `types/database.ts`. Ne jamais inventer un nom de
  colonne : s'il manque quelque chose, l'ajouter au contrat **et** signaler
  la migration correspondante dans le rapport final.
- Accès aux données :
  ```ts
  import { createClient } from "@/lib/supabase/server";
  const supabase = await createClient();
  if (!supabase) { /* mode démo : afficher <DemoNotice /> */ }
  ```
- `createClient()` renvoie `null` quand Supabase n'est pas configuré.
  **Aucune page ne doit planter dans ce cas** : soit un repli en lecture seule,
  soit un encart invitant à connecter Supabase.
- Les politiques RLS font la sécurité. Le code applicatif ne doit jamais
  s'appuyer sur un filtrage côté client pour cacher des données privées.

## Interface
- Réutiliser le kit existant, ne pas le dupliquer :
  `components/ui/{Button,Card,Chip,Stars,Field,States,Avatar,Icons}`
  et `components/books/{BookCard,BookCover}`.
- Couleurs **uniquement** via les tokens sémantiques : `bg-surface`, `text-ink`,
  `text-ink-soft`, `border-border`, `text-primary`, `bg-primary-soft`,
  `text-accent`, `text-gold`, `text-danger`, `text-success`.
  Les utilitaires `bc-gradient`, `bc-gradient-text`, `bc-card`, `bc-glow`,
  `bc-skeleton`, `no-scrollbar` sont disponibles.
  **Ne jamais écrire une couleur en dur** (`#7c3aed`, `bg-purple-600`) :
  cela casserait le mode sombre.
- **Mobile d'abord** : concevoir à 360 px, puis élargir avec `sm:`, `md:`, `lg:`.
- Cibles tactiles ≥ 44 px. Tout contrôle interactif a un libellé accessible.
- États : toujours prévoir chargement (`Skeleton`), vide (`EmptyState`) et erreur.

## Nommage des fichiers
- Composants en `PascalCase.tsx`, utilitaires en `kebab-case.ts`.
- Un dossier de route contient `page.tsx`, éventuellement `loading.tsx`,
  `actions.ts` (Server Actions) et ses composants propres.

## Qualité
- `npm run typecheck` et `npm run build` doivent passer avant de rendre un lot.
- Ne jamais modifier un fichier qui n'appartient pas à son lot : si un
  changement partagé est nécessaire, le signaler dans le rapport final.
