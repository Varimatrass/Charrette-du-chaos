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
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
