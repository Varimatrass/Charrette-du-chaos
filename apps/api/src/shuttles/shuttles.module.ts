import { Module } from "@nestjs/common";
import { ShuttlesController } from "./shuttles.controller";
import { ShuttlesService } from "./shuttles.service";

@Module({
  controllers: [ShuttlesController],
  providers: [ShuttlesService],
  exports: [ShuttlesService],
})
export class ShuttlesModule {}
