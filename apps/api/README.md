# @desordre/api — API NestJS

API REST de Charrette du Chaos (NestJS 12 en ESM + Prisma 7 + PostgreSQL). Voir le
README à la racine pour l'installation et le lancement ; ce fichier décrit
l'organisation du code de l'API.

## Organisation

```
src/
  main.ts                  # démarrage (port, CORS) — crash franc si la base est injoignable
  app.setup.ts             # ValidationPipe + CORS, partagé avec les tests d'intégration
  app.module.ts
  auth/                    # GET /admin/auth : vérification de la clé organisateur·ice
  health/                  # GET /health
  common/
    constants.ts           # noms d'en-têtes (x-admin-key, x-pax-token) et de variables d'env
    guards/                # AdminGuard (clé partagée), PaxTokenGuard (jeton personnel)
    decorators/            # @CurrentPax()
    pipes/                 # ParseEnumValuePipe pour nos enums `as const`
    dto/                   # DTO de query string communs (eventId)
    utils/                 # wait-level (attente en gare), dates, objects (omitUndefined...)
  prisma/                  # PrismaService (connexion avec tentatives au démarrage)
  events/ pax/ trips/ shuttles/ driver-availability/
                           # un module Nest par ressource : controller + service + dto/
  testing/                 # mock de PrismaService et fixtures pour les tests unitaires
test/
  *.e2e-spec.ts            # tests d'intégration HTTP (supertest) contre un vrai Postgres
  support/                 # env de test, création/migration de la base, createTestApp()
prisma/
  schema.prisma            # source de vérité du modèle de données
  migrations/              # SQL versionné (les renommages sont écrits à la main)
  seed.ts                  # jeu de données de démo (`pnpm prisma:seed`)
```

## Conventions

- **Code en anglais, interface en français.** Identifiants, routes HTTP,
  champs JSON, tables et colonnes sont en anglais ; les messages d'erreur
  destinés aux utilisateur·ices et les commentaires restent en français.
- **Vocabulaire :** `pax` (participant·e, gardé tel quel), `shuttle`
  (navette), `trip` (trajet aller ou retour d'un pax), `direction`
  (`OUTBOUND` = aller vers le lieu, `RETURN` = retour vers la gare),
  `wait level` (indicateur d'attente en gare).
- **Routes :** `/events` (lecture publique), `/pax` (inscription publique),
  `/pax/me/...` (auto-service avec `x-pax-token`), `/admin/...` (back-office
  avec `x-admin-key`).
- **Mises à jour partielles :** un champ absent du body n'est pas touché, un
  champ envoyé à `null` est effacé. Les DTO `Update*` dérivent des `Create*`
  avec `PartialType`/`OmitType`.
- **Enums :** déclarés dans `packages/shared-types` comme objets `as const`,
  compatibles avec ceux générés par Prisma (pas de cast).

## ESM

Le package est en `"type": "module"` (Nest 12 n'existe qu'en ESM) : les
imports relatifs portent l'extension `.js` (résolution `nodenext`), et les
tests tournent avec **Vitest** + SWC (`vitest.config.ts`, `vitest.e2e.config.ts`)
— SWC émet les métadonnées de décorateurs dont Nest et class-validator ont
besoin, ce qu'esbuild ne fait pas.

## Tests

```bash
pnpm test              # unitaires (Vitest, Prisma mocké) — src/**/*.spec.ts
pnpm test:cov          # idem avec couverture
pnpm test:e2e          # intégration (supertest) — test/*.e2e-spec.ts
```

Les tests d'intégration démarrent la vraie application contre une base
**dédiée** (`TEST_DATABASE_URL`, par défaut `charrette_test` sur le même
serveur Postgres que le dev), créée si besoin, remise à zéro et migrée
depuis les fichiers SQL de `prisma/migrations` avant la suite. Chaque test
repart d'une base vide.
