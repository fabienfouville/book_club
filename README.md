<div align="center">

# 📚 Bookclub

**La plateforme collaborative de notation et de recommandation de lecture.**

Référencez vos livres · notez-les · écrivez vos avis · recevez des
recommandations taillées pour vous · prêtez vos exemplaires à vos amis.

</div>

---

## Ce que fait Bookclub

| | |
|---|---|
| 📖 **Tout votre catalogue** | Recherche dans Open Library, import en un clic, ou ajout à la main. |
| ⭐ **Notes et avis** | Cinq étoiles au pouce, avis avec masquage des révélations, bouton « utile ». |
| 🧭 **Classement par genre** | 24 genres, filtrage par puces, tri par popularité ou par note. |
| ✨ **Recommandations** | Sous chaque livre, « Dans le même esprit » — et sur l'accueil, « Pour vous », d'après ce que vous avez lu. |
| 🔍 **Filtre de possession** | Voir uniquement les livres de votre bibliothèque, ou uniquement ceux qui n'y sont pas. |
| 👥 **Amis et communautés** | Vos amis ouvrent un compte, référencent leurs livres, rejoignent votre communauté et voient vos étagères. |
| 🤝 **Emprunts** | Marquez un livre « je le prête », recevez les demandes, acceptez, suivez le retour. |
| 💜 **Violet, rose, fantastique** | Thème clair et sombre, pensé d'abord pour le téléphone. |

## Démarrer en local

```bash
npm install
cp .env.example .env.local     # puis renseigner les clés Supabase
npm run dev                    # http://localhost:3000
```

Sans clés Supabase, le site démarre quand même en **mode démonstration**
(lecture seule, catalogue local). Pratique pour regarder l'interface tout de suite.

## Mettre en ligne

Tout est détaillé dans **[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)** :
créer le projet Supabase, appliquer les quatre migrations, déployer sur Vercel.
Compter 20 minutes, sans dépenser un centime.

## Clés nécessaires

Uniquement celles d'un projet **Supabase gratuit** :

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
```

Les métadonnées de livres viennent d'**Open Library** et de **Google Books**,
qui s'interrogent **sans aucune clé d'API**.

## Pile technique

Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 ·
Supabase (Postgres, Auth, RLS) · Vercel.

## Documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Choix techniques, modèle de données, moteur de recommandation |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Le backlog de la v1, epic par epic |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Mise en ligne pas à pas |
| [docs/BASE_DE_DONNEES.md](docs/BASE_DE_DONNEES.md) | Schéma, règles de visibilité, migrations |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Règles de contribution |

## Scripts

```bash
npm run dev        # développement
npm run build      # build de production
npm run typecheck  # vérification des types
npm run lint       # lint
```
