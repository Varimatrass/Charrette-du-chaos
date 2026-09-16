import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminAuthController } from "./auth/admin-auth.controller";
import { DriverAvailabilityModule } from "./driver-availability/driver-availability.module";
import { EventsModule } from "./events/events.module";
import { HealthController } from "./health/health.controller";
import { PaxModule } from "./pax/pax.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ShuttlesModule } from "./shuttles/shuttles.module";
import { TripsModule } from "./trips/trips.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    PaxModule,
    TripsModule,
    ShuttlesModule,
    DriverAvailabilityModule,
  ],
  controllers: [HealthController, AdminAuthController],
})
export class AppModule {}
