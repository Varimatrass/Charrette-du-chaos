import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ENV } from "../common/constants.js";

const CONNECT_MAX_ATTEMPTS = 5;
const CONNECT_RETRY_DELAY_MS = 2000;

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
      adapter: new PrismaPg({ connectionString: process.env[ENV.DATABASE_URL] }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetries();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Avec les driver adapters (obligatoires depuis Prisma 7), `$connect()`
   * ne garantit pas qu'une vraie connexion réseau a été établie : selon
   * l'adapter, elle peut être ouverte paresseusement, à la première requête.
   * Si la base est injoignable (pod arrêté, mauvais port...), l'appli
   * démarrait donc "normalement" pour planter bien plus tard sur la première
   * requête réelle — en 500 générique, sans que ce soit visible au démarrage.
   *
   * On vérifie donc explicitement la connexion avec une requête triviale,
   * avec quelques tentatives espacées pour encaisser un cas fréquent en dev
   * (le conteneur Postgres qui met une ou deux secondes à être prêt), puis on
   * abandonne franchement si la base reste injoignable : mieux vaut un crash
   * clair au démarrage qu'un serveur qui tourne mais ne peut rien faire.
   */
  private async connectWithRetries(
    maxAttempts = CONNECT_MAX_ATTEMPTS,
    retryDelayMs = CONNECT_RETRY_DELAY_MS,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        this.logger.log("Connecté à la base de données");
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          this.logger.error(
            `Impossible de se connecter à la base de données après ${maxAttempts} tentatives. ` +
              "Vérifie que le conteneur Postgres est bien lancé (`docker compose up -d db`) " +
              "et que DATABASE_URL pointe vers le bon host/port.",
          );
          throw error;
        }
        this.logger.warn(
          `Connexion à la base de données échouée (tentative ${attempt}/${maxAttempts}), ` +
            `nouvel essai dans ${retryDelayMs / 1000}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
}
