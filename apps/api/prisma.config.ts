// Config du CLI Prisma (depuis Prisma 7, l'URL de connexion ne se lit plus
// depuis schema.prisma — voir le commentaire dans prisma/schema.prisma).
// Ce fichier n'est utilisé que par les commandes `prisma generate` / `prisma
// migrate` / `prisma studio` : il n'a aucun effet sur l'API elle-même une
// fois démarrée (ça, c'est le rôle de l'adapter dans src/prisma/prisma.service.ts).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Seed explicite uniquement (comportement Prisma 7) : `pnpm prisma:seed`
    // depuis la racine, ou `prisma db seed` directement dans apps/api.
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
