import { Module } from "@nestjs/common";
import { ShuttlesModule } from "../shuttles/shuttles.module";
import { TripsModule } from "../trips/trips.module";
import { PaxController } from "./pax.controller";
import { PaxService } from "./pax.service";

@Module({
  imports: [ShuttlesModule, TripsModule],
  controllers: [PaxController],
  providers: [PaxService],
  exports: [PaxService],
})
export class PaxModule {}
