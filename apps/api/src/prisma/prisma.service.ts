import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Wrapper NestJS autour de PrismaClient : ouvre la connexion au démarrage
 * du module et la ferme proprement à l'arrêt de l'appli.
 *
 * Depuis Prisma 7, PrismaClient ne lit plus l'URL de connexion tout seul :
 * on doit lui fournir explicitement un "adapter" (ici, celui pour Postgres)
 * construit à partir de DATABASE_URL. C'est l'équivalent, côté exécution,
 * de ce que prisma.config.ts fait pour le CLI (generate/migrate).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connecté à la base de données");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
