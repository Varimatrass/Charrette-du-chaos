import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { DEFAULT_PORT, ENV } from "./common/constants";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureApp(app, { corsOrigins: config.get<string>(ENV.CORS_ORIGINS) });
  app.enableShutdownHooks();

  const port = config.get<string>(ENV.PORT) ?? DEFAULT_PORT;
  await app.listen(port);
  new Logger("Bootstrap").log(`API Charrette du Chaos démarrée sur http://localhost:${port}`);
}

// Si le démarrage échoue (ex: base de données injoignable — voir
// PrismaService.onModuleInit), on ne veut surtout pas laisser un process
// "à moitié démarré" tourner en silence : on logge clairement l'erreur et on
// quitte avec un code non nul, pour que ce soit visible immédiatement dans le
// terminal (et détectable par un outil de supervision en prod).
bootstrap().catch((error: unknown) => {
  new Logger("Bootstrap").error(
    "Échec du démarrage de l'API",
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
