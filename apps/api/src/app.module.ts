import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminAuthController } from "./auth/admin-auth.controller.js";
import { CarsModule } from "./cars/cars.module.js";
import { DriverAvailabilityModule } from "./driver-availability/driver-availability.module.js";
import { EventsModule } from "./events/events.module.js";
import { HealthController } from "./health/health.controller.js";
import { PaxModule } from "./pax/pax.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ShuttlesModule } from "./shuttles/shuttles.module.js";
import { StationsModule } from "./stations/stations.module.js";
import { TripsModule } from "./trips/trips.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    StationsModule,
    CarsModule,
    PaxModule,
    TripsModule,
    ShuttlesModule,
    DriverAvailabilityModule,
  ],
  controllers: [HealthController, AdminAuthController],
})
export class AppModule {}
