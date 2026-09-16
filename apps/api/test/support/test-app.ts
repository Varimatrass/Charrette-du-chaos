import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "../../src/app.module";
import { configureApp } from "../../src/app.setup";
import { ADMIN_KEY_HEADER, PAX_TOKEN_HEADER } from "../../src/common/constants";
import { PrismaService } from "../../src/prisma/prisma.service";
import { TEST_ADMIN_KEY } from "./env";

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  /** Requête HTTP brute, sans aucun en-tête d'authentification. */
  http: () => ReturnType<typeof request>;
  /** En-têtes prêts à passer à `.set(...)`. */
  asAdmin: Record<string, string>;
  asPax: (token: string) => Record<string, string>;
  /** Vide toutes les tables (à appeler dans un `beforeEach`). */
  resetDatabase: () => Promise<void>;
  close: () => Promise<void>;
}

/** Démarre l'application complète (vrais modules, vraie base) comme main.ts le ferait. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    http: () => request(app.getHttpServer()),
    asAdmin: { [ADMIN_KEY_HEADER]: TEST_ADMIN_KEY },
    asPax: (token) => ({ [PAX_TOKEN_HEADER]: token }),
    resetDatabase: async () => {
      // Les suppressions en cascade partent des évènements : tout le reste y est rattaché.
      await prisma.event.deleteMany();
    },
    close: () => app.close(),
  };
}
