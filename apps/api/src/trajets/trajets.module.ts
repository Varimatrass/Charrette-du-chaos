import { Module } from "@nestjs/common";
import { TrajetsController } from "./trajets.controller";
import { TrajetsService } from "./trajets.service";

@Module({
  controllers: [TrajetsController],
  providers: [TrajetsService],
  exports: [TrajetsService],
})
export class TrajetsModule {}
