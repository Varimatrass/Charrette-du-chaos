import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Wrapper NestJS autour de PrismaClient : ouvre la connexion au démarrage
 * du module et la ferme proprement à l'arrêt de l'appli.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connecté à la base de données");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
