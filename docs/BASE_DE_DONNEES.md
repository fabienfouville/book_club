# Base de données — Bookclub

Postgres géré par Supabase. Quatre fichiers de migration, à exécuter **dans
l'ordre**, une fois, dans l'éditeur SQL d'un projet Supabase neuf.

## Fichiers

| Ordre | Fichier | Contenu |
|---|---|---|
| 1 | `0001_schema.sql` | Types énumérés, tables, index, déclencheurs (dont la création automatique du profil à l'inscription) |
| 2 | `0002_rls.sql` | Row Level Security sur toutes les tables : c'est elle qui applique les règles de visibilité |
| 3 | `0003_views_functions.sql` | Vue `book_stats`, fonctions `similar_books`, `recommend_for_user`, `join_community_by_code` |
| 4 | `0004_seed.sql` | Les 24 genres et les 44 livres de démarrage |

Après le fichier 4, `Table Editor → books` doit contenir 44 lignes.

## Modèle de données

```
profiles            (id→auth.users, username, display_name, avatar_url, bio,
                     favorite_genres[], is_public, onboarded_at)
books                (id, source, source_id, isbn13, title, authors[], cover_url,
                     description, published_year, page_count, added_by)
genres               (slug, label, emoji, sort_order)
book_genres          (book_id, genre_slug)
library_items        (user_id, book_id, shelf, is_owned, is_lendable)
ratings              (user_id, book_id, rating 1..5)
reviews              (id, user_id, book_id, body, has_spoiler)
review_likes         (review_id, user_id)
friendships          (requester_id, addressee_id, status)
communities          (id, slug, name, owner_id, invite_code, is_open)
community_members    (community_id, user_id, role)
recommendations      (id, from_user, to_user, book_id, message, status)
loan_requests        (id, book_id, owner_id, borrower_id, status, message, due_at)
notifications        (id, user_id, kind, payload, read_at)
```

`books` est un catalogue **partagé** : un livre importé par un membre profite
à tout le monde. Déduplication sur `(source, source_id)`, puis sur `isbn13`.

## Règles de visibilité (RLS)

| Table | Qui peut lire |
|---|---|
| `books`, `genres`, `book_genres` | Tout le monde |
| `ratings`, `reviews`, `review_likes` | Tout le monde (c'est le cœur social du site) |
| `profiles` | Soi-même, ou si `is_public`, ou si ami, ou si communauté commune |
| `library_items` | Soi-même, ses amis acceptés, les membres de ses communautés |
| `friendships` | Les deux personnes concernées |
| `communities` | Tout le monde si `is_open`, sinon les membres uniquement |
| `loan_requests`, `notifications`, `recommendations` | Les personnes concernées uniquement |

Ces règles sont appliquées **en base**, pas seulement dans l'interface : même
une requête directe à l'API Supabase ne peut pas contourner cette visibilité.

## Moteur de recommandation

- `similar_books(p_book_id, p_limit)` — sous chaque fiche livre : genres
  partagés, auteur commun, co-notation (« ceux qui ont aimé ce livre ont
  aussi aimé… »).
- `recommend_for_user(p_user, p_limit)` — page d'accueil, bloc « Pour vous » :
  combine affinité de genre, auteurs appréciés, co-lecture, lectures des amis,
  et se replie sur la popularité générale si l'utilisateur n'a encore rien lu.
  Exclut toujours les livres déjà dans la bibliothèque de l'utilisateur.

Tout le calcul se fait en SQL, sans service externe ni clé d'API.

## Vérifier que tout est en place

```bash
npm run db:check
```

Se connecte avec les variables d'environnement et contrôle que chaque table,
la vue `book_stats` et les fonctions existent, puis affiche un rapport en
français. À lancer juste après avoir collé les quatre migrations.

## Mettre à jour le schéma plus tard

Ajouter un nouveau fichier `0005_....sql` plutôt que de modifier un fichier
déjà appliqué : Supabase ne sait pas rejouer une migration, seulement en
empiler de nouvelles.

## Sauvegardes

L'offre gratuite de Supabase ne fournit pas de sauvegarde téléchargeable.
Le workflow GitHub **« Sauvegarde de la base Supabase »** exporte chaque lundi
les schémas `public` (livres, bibliothèques, notes, avis…) et `auth`
(comptes), le compresse et le **chiffre en AES-256** avant de le stocker
comme artefact (90 jours). Le dépôt étant public, le fichier non chiffré
n'est jamais publié.

**Secrets** (Settings → Secrets and variables → Actions) :
- `SUPABASE_DB_URL` : Supabase → *Connect* → **Session pooler**, l'URI
  `postgresql://postgres.xxxx:[MOT-DE-PASSE]@aws-…pooler.supabase.com:5432/postgres`
  avec le mot de passe de la base. Pas la « Direct connection » : elle est en
  IPv6, que GitHub Actions ne joint pas.
- `BACKUP_PASSPHRASE` : une phrase secrète de votre choix. **Gardez-la dans
  un gestionnaire de mots de passe** : sans elle, les sauvegardes sont
  inutilisables.

**Restaurer** : télécharger l'artefact depuis l'onglet Actions, puis

```bash
gpg -d bookclub-AAAA-MM-JJ.sql.gz.gpg | gunzip > sauvegarde.sql
psql "<URI de la base cible>" -f sauvegarde.sql
```

Effet secondaire utile : cette connexion hebdomadaire compte comme une
activité, ce qui évite la mise en pause automatique du projet gratuit.
