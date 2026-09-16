import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DEFAULT_FRONTEND_URL } from "./common/constants";

/**
 * Réglages communs à l'appli réelle (main.ts) et aux tests d'intégration :
 * un seul endroit pour que les tests exercent exactement la même validation
 * et le même comportement HTTP que la prod.
 */
export function configureApp(app: INestApplication, options: { corsOrigins?: string } = {}): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ origin: parseCorsOrigins(options.corsOrigins) });
}

/** "a, b ,c" -> ["a", "b", "c"] ; vide ou absent -> l'URL du frontend en dev. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  const origins = (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : [DEFAULT_FRONTEND_URL];
}
