import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Pax } from "@prisma/client";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { CurrentPax } from "../common/decorators/current-pax.decorator.js";
import { EventIdQueryDto } from "../common/dto/event-id-query.dto.js";
import { PaxTokenGuard } from "../common/guards/pax-token.guard.js";
import { CarsService } from "./cars.service.js";
import { UpsertCarDto } from "./dto/upsert-car.dto.js";

@Controller()
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  /** Déclare ou met à jour sa voiture. */
  @UseGuards(PaxTokenGuard)
  @Put("pax/me/car")
  upsertMine(@CurrentPax() pax: Pax, @Body() dto: UpsertCarDto) {
    return this.carsService.upsertMine(pax, dto);
  }

  @UseGuards(PaxTokenGuard)
  @Delete("pax/me/car")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMine(@CurrentPax() pax: Pax) {
    return this.carsService.deleteMine(pax);
  }

  /** Voitures de son évènement, pour choisir celle où l'on a une place. */
  @UseGuards(PaxTokenGuard)
  @Get("pax/me/cars")
  findMyEventCars(@CurrentPax() pax: Pax) {
    return this.carsService.findAllForEventOverview(pax.eventId);
  }

  @UseGuards(AdminGuard)
  @Get("admin/cars")
  findAllForEvent(@Query() query: EventIdQueryDto) {
    return this.carsService.findAllForEventOverview(query.eventId);
  }
}
