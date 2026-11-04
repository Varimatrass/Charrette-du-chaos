import { CarsModule } from "../cars/cars.module.js";
import { Module } from "@nestjs/common";
import { ShuttlesController } from "./shuttles.controller.js";
import { ShuttlesService } from "./shuttles.service.js";

@Module({
  imports: [CarsModule],
  controllers: [ShuttlesController],
  providers: [ShuttlesService],
  exports: [ShuttlesService],
})
export class ShuttlesModule {}
