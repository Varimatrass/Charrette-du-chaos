import { Module } from "@nestjs/common";
import { NavettesModule } from "../navettes/navettes.module";
import { PaxController } from "./pax.controller";
import { PaxService } from "./pax.service";

@Module({
  imports: [NavettesModule],
  controllers: [PaxController],
  providers: [PaxService],
  exports: [PaxService],
})
export class PaxModule {}
