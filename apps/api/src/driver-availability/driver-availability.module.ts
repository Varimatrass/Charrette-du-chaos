import { Module } from "@nestjs/common";
import { DriverAvailabilityController } from "./driver-availability.controller.js";
import { DriverAvailabilityService } from "./driver-availability.service.js";

@Module({
  controllers: [DriverAvailabilityController],
  providers: [DriverAvailabilityService],
  exports: [DriverAvailabilityService],
})
export class DriverAvailabilityModule {}
