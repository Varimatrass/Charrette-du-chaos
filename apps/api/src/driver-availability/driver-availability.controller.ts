import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Pax } from "@prisma/client";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { CurrentPax } from "../common/decorators/current-pax.decorator.js";
import { EventIdQueryDto } from "../common/dto/event-id-query.dto.js";
import { PaxTokenGuard } from "../common/guards/pax-token.guard.js";
import { CreateDriverAvailabilitySlotDto } from "./dto/create-driver-availability-slot.dto.js";
import { DriverAvailabilityService } from "./driver-availability.service.js";

@Controller()
export class DriverAvailabilityController {
  constructor(private readonly driverAvailabilityService: DriverAvailabilityService) {}

  @UseGuards(PaxTokenGuard)
  @Post("pax/me/availability-slots")
  createMine(@CurrentPax() pax: Pax, @Body() dto: CreateDriverAvailabilitySlotDto) {
    return this.driverAvailabilityService.createMine(pax, dto);
  }

  @UseGuards(PaxTokenGuard)
  @Get("pax/me/availability-slots")
  findMine(@CurrentPax() pax: Pax) {
    return this.driverAvailabilityService.findMine(pax);
  }

  @UseGuards(PaxTokenGuard)
  @Delete("pax/me/availability-slots/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMine(@CurrentPax() pax: Pax, @Param("id", ParseUUIDPipe) id: string) {
    return this.driverAvailabilityService.deleteMine(pax, id);
  }

  /** Back-office : toutes les disponibilités déclarées pour un évènement. */
  @UseGuards(AdminGuard)
  @Get("admin/availability-slots")
  findAllForEvent(@Query() query: EventIdQueryDto) {
    return this.driverAvailabilityService.findAllForEvent(query.eventId);
  }
}
