import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigins = (config.get<string>("CORS_ORIGINS") ?? "http://localhost:4200")
    .split(",")
    .map((origin) => origin.trim());
  app.enableCors({ origin: corsOrigins });

  const port = config.get<string>("PORT") ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API Désordre Navettes démarrée sur http://localhost:${port}`);
}
bootstrap();
