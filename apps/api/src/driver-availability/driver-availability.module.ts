import { Module } from "@nestjs/common";
import { DriverAvailabilityController } from "./driver-availability.controller";
import { DriverAvailabilityService } from "./driver-availability.service";

@Module({
  controllers: [DriverAvailabilityController],
  providers: [DriverAvailabilityService],
  exports: [DriverAvailabilityService],
})
export class DriverAvailabilityModule {}
