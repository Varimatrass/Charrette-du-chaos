/**
 * Variables d'environnement des tests d'intégration. Chargé par Jest avant
 * chaque fichier de test (setupFiles), donc avant que ConfigModule ne lise
 * un éventuel .env : ce qui est défini ici a priorité.
 *
 * TEST_DATABASE_URL pointe vers une base DÉDIÉE : elle est vidée entre
 * chaque test. Ne mets jamais ta base de dev ici.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://charrette:charrette@localhost:5432/charrette_test";

export const TEST_ADMIN_KEY = "test-admin-key";
export const TEST_FRONTEND_URL = "https://navettes.test";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.ADMIN_KEY = TEST_ADMIN_KEY;
process.env.FRONTEND_URL = TEST_FRONTEND_URL;
