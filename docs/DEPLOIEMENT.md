# Mettre Bookclub en ligne — gratuitement

Compter environ 20 minutes. Tout ce qui suit tient dans les offres gratuites.
**Aucune carte bancaire n'est demandée.**

---

## 1. Créer la base de données (Supabase)

1. Aller sur <https://supabase.com> et créer un compte.
2. **New project** :
   - *Name* : `bookclub`
   - *Database password* : en générer un et le garder de côté.
   - *Region* : `Frankfurt` ou `Paris` si proposé (le plus proche de vos lecteurs).
   - *Plan* : **Free**.
3. Attendre 2 minutes que le projet s'initialise.

### Appliquer le schéma

Dans le menu de gauche, **SQL Editor** → **New query**. Coller puis exécuter
les fichiers de `supabase/migrations/`, **dans l'ordre**, un par un :

| Ordre | Fichier | Ce qu'il fait |
|---|---|---|
| 1 | `0001_schema.sql` | Crée les tables, index et déclencheurs |
| 2 | `0002_rls.sql` | Active la sécurité par ligne et les règles de visibilité |
| 3 | `0003_views_functions.sql` | Vues d'agrégats et moteur de recommandation |
| 4 | `0004_seed.sql` | Les 24 genres et le catalogue de démarrage |

Après le dernier, **Table Editor** doit montrer la table `books` remplie.

### Récupérer les clés

**Project Settings → API** :

| Champ Supabase | Variable |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

> La clé `service_role` contourne toutes les règles de sécurité.
> Elle ne doit **jamais** apparaître dans le code ni dans le navigateur :
> uniquement dans les variables d'environnement du serveur.

### Régler l'authentification

**Authentication → URL Configuration** :
- *Site URL* : l'adresse de votre site (par exemple `https://bookclub.vercel.app`).
- *Redirect URLs* : ajouter `https://votre-domaine/auth/callback`
  et `http://localhost:3000/auth/callback` pour le développement local.

**Authentication → Providers → Email** : laisser activé.
Pour tester entre amis sans attendre, décocher *Confirm email* ;
le réactiver ensuite.

---

## 2. Déployer le site (Vercel)

1. Aller sur <https://vercel.com>, se connecter avec GitHub.
2. **Add New → Project**, choisir le dépôt `book_club`.
3. Vercel détecte Next.js tout seul : ne rien changer aux réglages de build.
4. **Environment Variables**, ajouter les quatre lignes :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://votre-projet.vercel.app
```

5. **Deploy**. Au bout de deux minutes, le site est en ligne.
6. Revenir dans Supabase pour coller l'adresse définitive dans
   *Site URL* et *Redirect URLs*.

> La première fois, `NEXT_PUBLIC_SITE_URL` n'est pas encore connue.
> Déployer une première fois, relever l'adresse donnée par Vercel, la
> renseigner, puis redéployer.

---

## 3. Vérifier que tout marche

- [ ] La page d'accueil s'affiche avec des livres.
- [ ] `/decouvrir` liste le catalogue et la recherche répond.
- [ ] La création de compte fonctionne et le profil est créé automatiquement.
- [ ] Ajouter un livre à sa bibliothèque, le noter, écrire un avis.
- [ ] « Dans le même esprit » propose des livres sous une fiche.
- [ ] Depuis un second compte : demande d'ami, acceptation, demande d'emprunt.
- [ ] Tout reste lisible et cliquable sur un téléphone.

---

## Sans Supabase : le mode démonstration

Si les variables Supabase sont absentes, le site démarre quand même, en
**lecture seule**, sur le catalogue de démarrage local. Utile pour montrer
l'allure du site avant d'ouvrir un compte Supabase. La connexion, la notation
et les emprunts restent inactifs tant que la base n'est pas branchée.

---

## Ce que couvrent les offres gratuites

| Service | Offre gratuite | Ce que cela représente |
|---|---|---|
| Supabase | 500 Mo de base, 50 000 utilisateurs actifs/mois | très largement de quoi tenir pour un cercle d'amis |
| Vercel | 100 Go de trafic/mois | idem |
| Open Library | libre, sans clé | métadonnées et couvertures |
| Google Books | libre, sans clé, en secours | métadonnées |

Un projet Supabase gratuit se met en pause après une semaine sans activité ;
il suffit de le relancer d'un clic depuis le tableau de bord.
