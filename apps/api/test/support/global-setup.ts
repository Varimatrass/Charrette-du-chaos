import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./env";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "prisma", "migrations");

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
