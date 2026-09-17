import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./env.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "prisma", "migrations");

/**
 * Avant toute la suite d'intégration : on repart d'un schéma vide et on
 * rejoue les migrations SQL dans l'ordre, directement avec `pg`.
 *
 * Pourquoi pas `prisma migrate deploy` ? Il fait la même chose mais exige
 * de télécharger le moteur Prisma, ce qui n'est pas toujours possible (CI
 * hors-ligne, réseau filtré). Rejouer les fichiers SQL garde en plus la
 * garantie que la chaîne de migrations fonctionne depuis zéro.
 */
export default async function globalSetup(): Promise<void> {
  await ensureDatabaseExists(TEST_DATABASE_URL);

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const migration of migrations) {
      const sql = readFileSync(join(MIGRATIONS_DIR, migration, "migration.sql"), "utf8");
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

const DATABASE_DOES_NOT_EXIST = "3D000";

/**
 * Crée la base de test si elle n'existe pas encore (première exécution en
 * local : le conteneur Postgres du docker-compose ne connaît que la base
 * de dev). On passe par la base de maintenance `postgres` du même serveur.
 */
async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const probe = new Client({ connectionString: databaseUrl });
  try {
    await probe.connect();
    return;
  } catch (error) {
    if ((error as { code?: string }).code !== DATABASE_DOES_NOT_EXIST) throw error;
  } finally {
    await probe.end().catch(() => undefined);
  }

  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, "");
  url.pathname = "/postgres";
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }
}
