# Charrette du Chaos — Gestion des navettes

Outil communautaire pour gérer les navettes (et bientôt le covoiturage) des
évènements en autogestion. Développé pour Le Désordre mais pensé pour être
réutilisable par d'autres collectifs. Cette V1 couvre les **navettes gare ↔
lieu** ; le covoiturage viendra dans une itération suivante (le modèle de
données est déjà pensé pour).

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

- [Docker](https://docs.docker.com/engine/install/) ou
  [Podman](https://podman.io/docs/installation) (avec le plugin `compose`) —
  c'est ce qui fait tourner la base de données, jamais installée "à la main"
  sur ta machine. Voir plus bas si tu utilises Podman.
- Node.js ≥ 22.12 et [pnpm](https://pnpm.io/) ≥ 10 (`corepack enable` suffit)
  — nécessaires seulement si tu veux lancer l'API/le frontend en natif (voir
  "Lancer en développement" ci-dessous). Si tu fais tourner absolument tout
  en conteneurs, tu n'en as pas besoin sur ta machine.

## Installation

```bash
pnpm install
```

Ça installe tout (les 3 packages du monorepo) et compile automatiquement
`packages/shared-types` (script `prepare`). Pas nécessaire si tu comptes tout
faire tourner en conteneurs dès le départ (l'image Docker fait son propre
`pnpm install` à l'intérieur) — mais ça ne mange pas de pain de le faire pour
avoir l'autocomplétion de ton éditeur.

## Configuration

```bash
cp .env.example .env                    # identifiants de la base (docker-compose)
cp apps/api/.env.example apps/api/.env  # config de l'API
```

Dans `apps/api/.env`, remplis surtout :

- `ADMIN_KEY` — une clé longue et aléatoire, c'est ce qui protège le
  back-office organisateur·ice pour cette V1 (pas encore de vrais comptes) —
  ne la commite jamais.
- `DATABASE_URL` — laisse la valeur par défaut si tu utilises Docker/Podman
  (voir plus bas), sinon mets ta vraie chaîne de connexion.
- `FRONTEND_URL` / `CORS_ORIGINS` — l'URL du frontend (déjà correcte en dev).

## Base de données : ce que font les commandes Prisma

Prisma est l'outil qui fait le pont entre le schéma de base de données
(`apps/api/prisma/schema.prisma`) et le code TypeScript de l'API. Deux
commandes, deux rôles différents :

- **`pnpm prisma:generate`** — lit le schéma et génère du code TypeScript
  (le "client Prisma") pour que l'API puisse parler à la base avec du
  typage strict. Ça ne touche jamais à la base de données elle-même, c'est
  juste de la génération de code. À refaire chaque fois que le schéma
  change.
- **`pnpm prisma:migrate`** — compare le schéma à l'état réel de la base,
  génère un fichier de migration SQL (les changements à appliquer : créer
  telle table, ajouter telle colonne...) et l'applique à la base. C'est cette
  commande qui crée vraiment les tables. La première fois, elle demande un
  nom de migration (ex: `init`) — c'est juste pour l'historique, tape ce que
  tu veux.

Les deux ont besoin d'un accès internet normal (elles téléchargent des
binaires Prisma) : ça n'a pas pu être vérifié bout en bout dans mon
environnement cloud pour préparer ce scaffolding (réseau restreint côté
sandbox), donc c'est la première vraie exécution chez toi — dis-moi si
quelque chose coince.

## Lancer en développement

### Option A — tout en conteneurs (recommandé, rien à installer d'autre)

```bash
docker compose up --build
```

Ça construit et démarre les trois services : la base Postgres (jamais
installée en dur sur ta machine, ses données vivent dans un volume Docker
nommé `pgdata`), l'API sur `http://localhost:3000`, et le frontend sur
`http://localhost:4200`. Le code de `apps/` et `packages/` est monté en
direct dans les conteneurs : modifier un fichier chez toi recharge l'API/le
frontend automatiquement, pas besoin de reconstruire l'image à chaque fois.

Il ne reste plus qu'à lancer les migrations Prisma, à l'intérieur du
conteneur de l'API :

```bash
docker compose run --rm api pnpm prisma:generate
docker compose run --rm api pnpm prisma:migrate
```

**Avec Podman** : `podman compose up --build` fonctionne pareil (Podman sait
lire un `docker-compose.yml` directement via son plugin `compose`, pas besoin
de fichier séparé). Si `podman compose` n'est pas disponible chez toi,
installe `podman-compose` (`pip install podman-compose` ou le paquet de ta
distro) et remplace `docker compose` par `podman-compose` dans les commandes
ci-dessus.

### Option B — juste la base en conteneur, API/frontend en natif (itération plus rapide)

```bash
docker compose up -d db     # ou : podman compose up -d db
pnpm prisma:generate
pnpm prisma:migrate
```

Puis, dans deux terminaux séparés :

```bash
pnpm dev:api   # démarre l'API sur http://localhost:3000
pnpm dev:web   # démarre le frontend sur http://localhost:4200
```

Cette option évite de reconstruire une image Docker à chaque changement de
dépendance, au prix d'avoir Node/pnpm installés chez toi. Le point important
(la base de données jamais installée "à l'arrache") reste garanti dans les
deux cas : elle tourne toujours en conteneur.

> Le rechargement à chaud du frontend dans un conteneur repose sur les
> notifications de changement de fichier du système ; ça fonctionne
> nativement sous Linux. Si jamais ça ne réagit pas après une modif, ajoute
> `--poll 2000` à la commande `pnpm run start` dans `apps/web/Dockerfile.dev`.

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

Les `Dockerfile.dev` (racine de `apps/web` et `apps/api`) sont pour le dev
uniquement (rechargement à chaud) — un vrai `Dockerfile` de prod (image plus
légère, sans bind mount) sera à écrire au moment du déploiement.

## Déploiement (pistes, à confirmer ensemble)

- **Base de données** : Supabase ou Neon (PostgreSQL gratuit à cette échelle)
- **API (`apps/api`)** : Render ou Railway (free tier) — c'est un serveur Node
  classique (`node dist/main.js` après `pnpm --filter @desordre/api build`)
- **Frontend (`apps/web`)** : Cloudflare Pages ou Netlify — c'est un site
  statique après `pnpm --filter @desordre/web build` (dossier `dist/web`)

Ces trois services se déploient en général directement depuis un dépôt git —
maintenant que le projet est sur GitHub, on pourra brancher ça dans une
itération à venir.

## Structure du projet

```
apps/
  web/                  # Angular — formulaire pax + back-office organisateur·ice
  api/                  # NestJS — API REST + Prisma
packages/
  shared-types/         # enums, modèles et DTOs partagés front/back
docker-compose.yml      # base de données + (optionnellement) API/frontend en conteneurs
```

## Ce qui est fait en V1 / ce qui reste

Fait : inscription et auto-édition libre des trajets par les paxs (lien
personnel, sans compte, jamais bloquant), gestion des navettes et assignation
manuelle côté back-office, indicateur de temps d'attente en gare calculé
automatiquement, recherche d'un pax pour retrouver un lien perdu.

Pas encore (itérations suivantes, voir la spec) : covoiturage (mise en
relation conducteur·ices/passager·es), vraie liste de comptes organisateur·ices,
envoi automatique d'email du lien personnel, vrai déploiement.
