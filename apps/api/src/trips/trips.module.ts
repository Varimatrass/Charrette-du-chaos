import { Module } from "@nestjs/common";
import { CarsModule } from "../cars/cars.module.js";
import { ShuttlesModule } from "../shuttles/shuttles.module.js";
import { StationsModule } from "../stations/stations.module.js";
import { TripsController } from "./trips.controller.js";
import { TripsService } from "./trips.service.js";

@Module({
  imports: [StationsModule, CarsModule, ShuttlesModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
