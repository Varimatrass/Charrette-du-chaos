import { Module } from "@nestjs/common";
import { PaxController } from "./pax.controller";
import { PaxService } from "./pax.service";

@Module({
  controllers: [PaxController],
  providers: [PaxService],
  exports: [PaxService],
})
export class PaxModule {}
