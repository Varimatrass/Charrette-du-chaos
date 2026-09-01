# Le Désordre — Gestion des navettes

Remplace petit à petit le Google Sheet de gestion des transports pour les
évènements Le Désordre. Cette V1 couvre les **navettes gare ↔ lieu** ; le
covoiturage viendra dans une itération suivante (le modèle de données est
déjà pensé pour).

Voir aussi le document de spec complet (contexte, décisions produit) dans le
projet Claude "Le désordre" → `spec-navettes-v1.md`.

## Stack

- **apps/web** — Angular 20 (standalone, TypeScript strict) + Angular Material
- **apps/api** — NestJS 11 (TypeScript strict) + Prisma + PostgreSQL
- **packages/shared-types** — types et DTOs partagés entre le front et le back
- **pnpm** workspaces comme gestionnaire de paquets

Front et back sont deux applications séparées (pas de framework full-stack
type Next.js) qui communiquent uniquement via l'API HTTP de `apps/api`.

## Pré-requis

- Node.js ≥ 22.12 (testé avec 22.22)
- [pnpm](https://pnpm.io/) ≥ 10 (`corepack enable` suffit si tu as Node ≥ 16.13)
- Une base PostgreSQL accessible (Supabase, Neon, ou une instance locale/Docker)

## Installation

```bash
pnpm install
```

Ça installe tout (les 3 packages du monorepo) et compile automatiquement
`packages/shared-types` (script `prepare`).

## Configuration

```bash
cp apps/api/.env.example apps/api/.env
```

Puis remplis dans `apps/api/.env` :

- `DATABASE_URL` — ta chaîne de connexion PostgreSQL
- `ADMIN_KEY` — une clé longue et aléatoire, c'est ce qui protège le
  back-office organisateur·ice pour cette V1 (pas encore de vrais comptes)
- `FRONTEND_URL` — l'URL du frontend (`http://localhost:4200` en dev), utilisée
  pour construire le lien personnel envoyé aux paxs
- `CORS_ORIGINS` — pareil, l'URL du frontend

## Base de données

```bash
pnpm prisma:generate   # génère le client Prisma à partir du schéma
pnpm prisma:migrate    # crée les tables dans ta base (demande un nom de migration)
```

> ⚠️ **Important** : ces deux commandes ont besoin d'un accès réseau normal
> (elles téléchargent les moteurs Prisma). Je n'ai pas pu les exécuter dans
> mon environnement cloud pour builder ce scaffolding (accès réseau restreint
> à certains domaines) — le code est écrit et cohérent avec le schéma
> (`apps/api/prisma/schema.prisma`), mais **tu devras lancer ces deux commandes
> toi-même en premier**, avant de pouvoir démarrer l'API ou la builder. Une
> fois fait, tout le reste (build, dev, types) doit fonctionner normalement.

`pnpm prisma:studio` ouvre une interface web pour explorer/éditer les données
directement (pratique pour dépanner pendant un évènement).

## Lancer en développement

Dans deux terminaux séparés :

```bash
pnpm dev:api   # démarre l'API sur http://localhost:3000
pnpm dev:web   # démarre le frontend sur http://localhost:4200
```

## Créer une édition et tester le parcours

1. Va sur `http://localhost:4200/admin/connexion`, entre la valeur de `ADMIN_KEY`.
2. Crée une édition (nom, dates, lieu, gare de référence).
3. Le formulaire pax public est sur `http://localhost:4200/e/<id-de-l-edition>`
   — c'est ce lien qu'on partage aux paxs avant l'évènement.
4. Une fois inscrit·e, le pax atterrit sur `/mon-espace/<jeton>` : c'est son
   lien personnel, à garder pour revenir modifier ses trajets aller/retour
   quand il veut, sans jamais être bloqué.
5. Dans le back-office (`/admin/editions/<id>`), onglet **Navettes**, crée les
   créneaux ; onglet **Trajets / demandes**, assigne chaque pax à une navette
   via le menu déroulant.

## Build de prod

```bash
pnpm build
```

## Déploiement (pistes, à confirmer ensemble)

- **Base de données** : Supabase ou Neon (PostgreSQL gratuit à cette échelle)
- **API (`apps/api`)** : Render ou Railway (free tier) — c'est un serveur Node
  classique (`node dist/main.js` après `pnpm --filter @desordre/api build`)
- **Frontend (`apps/web`)** : Cloudflare Pages ou Netlify — c'est un site
  statique après `pnpm --filter @desordre/web build` (dossier `dist/web`)

Ces trois services se déploient en général directement depuis un dépôt git —
ce sera plus simple une fois le projet poussé sur GitHub (prochaine itération).

## Structure du projet

```
apps/
  web/                  # Angular — formulaire pax + back-office organisateur·ice
  api/                  # NestJS — API REST + Prisma
packages/
  shared-types/         # enums, modèles et DTOs partagés front/back
```

## Ce qui est fait en V1 / ce qui reste

Fait : inscription et auto-édition libre des trajets par les paxs (lien
personnel, sans compte, jamais bloquant), gestion des navettes et assignation
manuelle côté back-office, indicateur de temps d'attente en gare calculé
automatiquement, recherche d'un pax pour retrouver un lien perdu.

Pas encore (itérations suivantes, voir la spec) : covoiturage (mise en
relation conducteur·ices/passager·es), vraie liste de comptes organisateur·ices,
envoi automatique d'email du lien personnel.
