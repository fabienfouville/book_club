# Bookclub — Architecture

## Objectif
Plateforme collaborative de notation, d'avis et de recommandation de lecture.
Chacun référence ses livres, les note, les critique, les recommande à ses amis,
rejoint des communautés et emprunte les livres des autres.

## Contraintes
- **Gratuit** : uniquement des offres free tier, aucune API payante.
- **Mobile-first** : utilisable au pouce, sur un écran de 360 px.
- **Simple** : pas de jargon, 3 clics max pour ajouter un livre.
- **Identité visuelle** : violet / rose / fantastique.

## Stack retenue

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | SSR pour le SEO des fiches livres, Server Actions pour les mutations, un seul déploiement. |
| UI | **Tailwind CSS v4** + composants maison | Pas de dépendance lourde, thème violet/rose piloté par tokens CSS. |
| Base de données | **Supabase Postgres** (free tier) | Postgres managé gratuit, RLS native, temps réel inclus. |
| Auth | **Supabase Auth** (email magic link + mot de passe) | Gratuit, pas de clé tierce, sessions gérées via cookies SSR. |
| Sécurité données | **Row Level Security** sur toutes les tables | La visibilité « amis / communauté » est appliquée en base, pas seulement dans l'UI. |
| Métadonnées livres | **Open Library** (principal) + **Google Books** (secours) | Les deux fonctionnent **sans clé API**. Couvertures servies par covers.openlibrary.org. |
| Hébergement | **Vercel** (hobby) | Gratuit, intégration Next.js native, preview par PR. |
| Images | `next/image` avec `remotePatterns` | Optimisation gratuite côté Vercel. |

### Ce qui n'est PAS utilisé, et pourquoi
- Pas de LLM pour les recommandations : coûte une clé payante. Le moteur est un
  hybride **contenu + collaboratif** en SQL, suffisant et instantané.
- Pas de Stripe, pas d'envoi d'e-mails transactionnels maison : Supabase Auth
  envoie déjà les e-mails de connexion sur son quota gratuit.

## Modèle de données (Postgres)

```
profiles            (id→auth.users, username, display_name, avatar_url, bio, is_public)
books               (id, source, source_id, isbn13, title, authors[], cover_url,
                     published_year, description, page_count, language)
genres              (slug, label, emoji, color)
book_genres         (book_id, genre_slug)
library_items       (user_id, book_id, shelf, is_owned, is_lendable, added_at)
                     shelf ∈ {wishlist, reading, read, abandoned}
ratings             (user_id, book_id, rating 1..5)
reviews             (id, user_id, book_id, body, has_spoiler, created_at)
review_likes        (review_id, user_id)
friendships         (requester_id, addressee_id, status)  status ∈ {pending, accepted, blocked}
communities         (id, slug, name, description, owner_id, invite_code, is_open)
community_members   (community_id, user_id, role)         role ∈ {owner, member}
recommendations     (id, from_user, to_user, book_id, message, status)
loan_requests       (id, book_id, owner_id, borrower_id, status, message, due_at)
                     status ∈ {pending, accepted, declined, borrowed, returned, cancelled}
notifications       (id, user_id, kind, payload, read_at)
```

`books` est un **catalogue partagé et dédupliqué** : un livre importé par un
membre est disponible pour tous. La clé de dédup est `(source, source_id)` avec
`isbn13` en index secondaire.

## Moteur de recommandation

Trois signaux combinés, calculés en SQL (fonction `recommend_for_user`) :

1. **Affinité de contenu** — genres et auteurs les mieux notés par l'utilisateur.
2. **Filtrage collaboratif léger** — co-occurrence : « les membres qui ont aimé
   ce livre ont aussi aimé… », via une jointure sur `ratings >= 4`.
3. **Signal social** — ce que lisent et notent les amis et la communauté.

Sous chaque fiche livre : `similar_books(book_id)` = genres partagés + auteur
commun + co-notation, pondérés. Aucun appel externe, aucune clé.

## Règles de visibilité (RLS)
- Mon profil et mes étagères : visibles par moi, mes amis acceptés, et les
  membres de mes communautés.
- Avis et notes : publics par défaut (c'est le cœur social du site).
- Livres prêtables : visibles seulement par les amis et la communauté.
- Demandes d'emprunt : visibles par l'emprunteur et le propriétaire uniquement.

## Arborescence

```
app/
  (marketing)/           page d'accueil publique
  (app)/
    decouvrir/           catalogue + recherche + filtres genre
    livre/[id]/          fiche livre, notes, avis, recommandations
    bibliotheque/        ma bibliothèque + filtre possédé / non possédé
    amis/                amis, demandes, recommandations reçues
    communaute/[slug]/   membres, étagères partagées, emprunts
    emprunts/            demandes envoyées / reçues
    profil/[username]/   profil public
  auth/                  connexion, inscription, callback
lib/
  supabase/              clients browser / server / admin
  books/                 adaptateurs Open Library + Google Books
  recommendations/       accès au moteur
components/
  ui/                    design system (Button, Card, Rating, Sheet…)
  books/ library/ social/
supabase/migrations/     SQL versionné
```

## Environnement requis
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # import de livres en masse uniquement
NEXT_PUBLIC_SITE_URL=
```
Aucune autre clé. Open Library et Google Books sont appelés sans authentification.
