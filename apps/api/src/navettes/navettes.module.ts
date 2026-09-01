import { Module } from "@nestjs/common";
import { NavettesController } from "./navettes.controller";
import { NavettesService } from "./navettes.service";

@Module({
  controllers: [NavettesController],
  providers: [NavettesService],
  exports: [NavettesService],
})
export class NavettesModule {}
