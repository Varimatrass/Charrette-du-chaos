import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { EventsModule } from "./events/events.module";
import { PaxModule } from "./pax/pax.module";
import { TrajetsModule } from "./trajets/trajets.module";
import { NavettesModule } from "./navettes/navettes.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    PaxModule,
    TrajetsModule,
    NavettesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
