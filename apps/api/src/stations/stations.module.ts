import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module.js";
import { StationsController } from "./stations.controller.js";
import { StationsService } from "./stations.service.js";

@Module({
  imports: [EventsModule],
  controllers: [StationsController],
  providers: [StationsService],
  exports: [StationsService],
})
export class StationsModule {}
