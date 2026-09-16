# Bookclub — Backlog de la v1 (première mise en prod)

Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait
Priorité : **P0** = bloquant pour la mise en prod · **P1** = attendu par l'utilisateur · **P2** = après la v1

---

## EPIC 0 — Fondations
| # | Tâche | Prio | État |
|---|---|---|---|
| 0.1 | Choix d'architecture + doc `ARCHITECTURE.md` | P0 | [x] |
| 0.2 | Backlog v1 (ce document) | P0 | [x] |
| 0.3 | Scaffold Next.js 15 + TypeScript + Tailwind v4 | P0 | [x] |
| 0.4 | Thème violet/rose « fantastique » : tokens, dégradés, mode sombre | P0 | [x] |
| 0.5 | Layout mobile-first : barre de navigation basse, en-tête, conteneurs | P0 | [x] |
| 0.6 | Clients Supabase (navigateur / serveur / admin) + middleware de session | P0 | [x] |
| 0.7 | Types TypeScript de la base | P0 | [x] |
| 0.8 | Lint + typecheck + build en CI (GitHub Actions) | P0 | [x] |
| 0.9 | `README` d'installation + `.env.example` | P0 | [x] |

## EPIC 1 — Base de données et sécurité
| # | Tâche | Prio | État |
|---|---|---|---|
| 1.1 | Migration : `profiles`, trigger de création à l'inscription | P0 | [x] |
| 1.2 | Migration : `books`, `genres`, `book_genres` + dédup `(source, source_id)` | P0 | [x] |
| 1.3 | Migration : `library_items`, `ratings`, `reviews`, `review_likes` | P0 | [x] |
| 1.4 | Migration : `friendships`, `communities`, `community_members` | P0 | [x] |
| 1.5 | Migration : `recommendations`, `loan_requests`, `notifications` | P0 | [x] |
| 1.6 | Politiques RLS sur toutes les tables (amis / communauté / privé) | P0 | [x] |
| 1.7 | Vues agrégées : note moyenne, nombre d'avis, popularité | P0 | [x] |
| 1.8 | Fonctions SQL `similar_books()` et `recommend_for_user()` | P0 | [x] |
| 1.9 | Seed : ~24 genres + catalogue de démarrage de livres connus | P0 | [x] |
| 1.10 | Script de vérification du schéma (`npm run db:check`) | P1 | [x] |

## EPIC 2 — Authentification et profil
| # | Tâche | Prio | État |
|---|---|---|---|
| 2.1 | Inscription e-mail + mot de passe | P0 | [x] |
| 2.2 | Connexion + déconnexion + route de callback | P0 | [x] |
| 2.3 | Lien magique (connexion sans mot de passe) | P1 | [x] |
| 2.4 | Onboarding : pseudo, nom affiché, genres préférés | P1 | [x] |
| 2.5 | Page profil publique `/profil/[username]` | P1 | [x] |
| 2.6 | Édition du profil (bio, avatar, visibilité) | P1 | [x] |
| 2.7 | Protection des routes privées (middleware) | P0 | [x] |
| 2.8 | Mode démo sans compte (lecture seule) si Supabase non configuré | P1 | [x] |

## EPIC 3 — Catalogue de livres
| # | Tâche | Prio | État |
|---|---|---|---|
| 3.1 | Adaptateur Open Library (recherche, détail, couverture) — sans clé | P0 | [x] |
| 3.2 | Adaptateur Google Books en secours | P1 | [x] |
| 3.3 | Normalisation + import dédupliqué dans `books` | P0 | [x] |
| 3.4 | Page `/decouvrir` : recherche, résultats, import en un clic | P0 | [x] |
| 3.5 | Filtres par genre (puces horizontales scrollables) | P0 | [x] |
| 3.6 | Filtre « dans ma bibliothèque / pas dans ma bibliothèque » | P0 | [x] |
| 3.7 | Tri : populaire, mieux noté, récent, alphabétique | P1 | [x] |
| 3.8 | Fiche livre `/livre/[id]` : couverture, résumé, genres, stats | P0 | [x] |
| 3.9 | Ajout manuel d'un livre absent des catalogues | P1 | [x] |
| 3.10 | Pagination / chargement progressif | P1 | [x] |

## EPIC 4 — Ma bibliothèque
| # | Tâche | Prio | État |
|---|---|---|---|
| 4.1 | Ajouter / retirer un livre de la bibliothèque | P0 | [x] |
| 4.2 | Étagères : envie de lire, en cours, lu, abandonné | P0 | [x] |
| 4.3 | Marqueur « je possède ce livre » (physique) | P0 | [x] |
| 4.4 | Marqueur « je le prête volontiers » | P0 | [x] |
| 4.5 | Page `/bibliotheque` avec filtres genre + étagère + possession | P0 | [x] |
| 4.6 | Statistiques de lecture (livres lus, pages, genre favori) | P1 | [x] |
| 4.7 | Basculement grille / liste | P2 | [ ] |

## EPIC 5 — Notes et avis
| # | Tâche | Prio | État |
|---|---|---|---|
| 5.1 | Notation 1→5 étoiles, tactile, modifiable | P0 | [x] |
| 5.2 | Rédaction d'un avis + marqueur spoiler | P0 | [x] |
| 5.3 | Modification / suppression de son avis | P0 | [x] |
| 5.4 | Fil des avis sur la fiche livre | P0 | [x] |
| 5.5 | « Utile » sur un avis (like) | P1 | [x] |
| 5.6 | Note moyenne + répartition des étoiles | P1 | [x] |

## EPIC 6 — Recommandations
| # | Tâche | Prio | État |
|---|---|---|---|
| 6.1 | Moteur hybride contenu + collaboratif (SQL) | P0 | [x] |
| 6.2 | Bloc « Dans le même esprit » sous chaque fiche livre | P0 | [x] |
| 6.3 | Page d'accueil connectée : « Pour vous », d'après vos lectures | P0 | [x] |
| 6.4 | Explication de la reco (« parce que vous avez aimé X ») | P1 | [x] |
| 6.5 | Recommander un livre à un ami, avec un mot | P0 | [x] |
| 6.6 | Boîte de réception des recommandations reçues | P0 | [x] |

## EPIC 7 — Social, amis et communautés
| # | Tâche | Prio | État |
|---|---|---|---|
| 7.1 | Recherche de membres par pseudo | P0 | [x] |
| 7.2 | Demande d'ami, acceptation, refus, retrait | P0 | [x] |
| 7.3 | Voir la bibliothèque d'un ami | P0 | [x] |
| 7.4 | Créer une communauté + code d'invitation | P0 | [x] |
| 7.5 | Rejoindre une communauté via un code ou un lien | P0 | [x] |
| 7.6 | Page communauté : membres, étagères partagées, livres prêtables | P0 | [x] |
| 7.7 | Fil d'activité de la communauté | P1 | [x] |

## EPIC 8 — Emprunts
| # | Tâche | Prio | État |
|---|---|---|---|
| 8.1 | Bouton « Demander à emprunter » sur un livre prêtable | P0 | [x] |
| 8.2 | Demande avec message et date de retour souhaitée | P0 | [x] |
| 8.3 | Page `/emprunts` : demandes reçues / envoyées | P0 | [x] |
| 8.4 | Accepter, refuser, marquer prêté, marquer rendu | P0 | [x] |
| 8.5 | Blocage : un exemplaire déjà prêté ne peut pas être redemandé | P1 | [x] |
| 8.6 | Notifications sur changement de statut | P1 | [x] |

## EPIC 9 — Expérience et interface
| # | Tâche | Prio | État |
|---|---|---|---|
| 9.1 | Design system : boutons, cartes, puces, panneaux, champs | P0 | [x] |
| 9.2 | Navigation basse mobile (5 onglets) + navigation latérale bureau | P0 | [x] |
| 9.3 | États vides illustrés et encourageants | P1 | [x] |
| 9.4 | Squelettes de chargement | P1 | [x] |
| 9.5 | Accessibilité : contrastes, focus, libellés ARIA, cibles ≥ 44 px | P0 | [x] |
| 9.6 | Métadonnées SEO + Open Graph + favicon + manifeste PWA | P1 | [x] |
| 9.7 | Page 404 / page d'erreur soignées | P1 | [x] |
| 9.8 | Mode sombre | P1 | [x] |

## EPIC 10 — Mise en prod
| # | Tâche | Prio | État |
|---|---|---|---|
| 10.1 | `.env.example` + guide de création du projet Supabase | P0 | [x] |
| 10.2 | Guide de déploiement Vercel (`docs/DEPLOIEMENT.md`) | P0 | [x] |
| 10.3 | CI GitHub Actions : typecheck + lint + build | P0 | [x] |
| 10.4 | Vérification build de production | P0 | [x] |
| 10.5 | Déploiement effectif + variables d'environnement | P0 | [ ] ⏳ **nécessite vos clés Supabase** |
| 10.6 | Passage des migrations sur le projet Supabase | P0 | [ ] ⏳ **nécessite vos clés Supabase** |
| 10.7 | Recette mobile sur appareil réel | P1 | [ ] |

## Hors v1 (P2, notés pour plus tard)
- Scan de code-barres ISBN avec l'appareil photo
- Import Goodreads / Babelio (CSV)
- Défis de lecture et badges
- Notifications push
- Discussions par livre dans la communauté
- Traduction anglaise de l'interface
