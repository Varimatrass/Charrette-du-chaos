import { Module } from "@nestjs/common";
import { ShuttlesModule } from "../shuttles/shuttles.module.js";
import { TripsModule } from "../trips/trips.module.js";
import { PaxController } from "./pax.controller.js";
import { PaxService } from "./pax.service.js";

@Module({
  imports: [ShuttlesModule, TripsModule],
  controllers: [PaxController],
  providers: [PaxService],
  exports: [PaxService],
})
export class PaxModule {}
