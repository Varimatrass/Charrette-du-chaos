import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { Pax } from "@prisma/client";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentPax } from "../common/decorators/current-pax.decorator";
import { PaxTokenGuard } from "../common/guards/pax-token.guard";
import { CreateDriverAvailabilitySlotDto } from "./dto/create-driver-availability-slot.dto";
import { DriverAvailabilityService } from "./driver-availability.service";

@Controller()
export class DriverAvailabilityController {
  constructor(private readonly driverAvailabilityService: DriverAvailabilityService) {}

  @UseGuards(PaxTokenGuard)
  @Post("pax/moi/disponibilites")
  createMine(@CurrentPax() pax: Pax, @Body() dto: CreateDriverAvailabilitySlotDto) {
    return this.driverAvailabilityService.createMine(pax, dto);
  }

  @UseGuards(PaxTokenGuard)
  @Get("pax/moi/disponibilites")
  findMine(@CurrentPax() pax: Pax) {
    return this.driverAvailabilityService.findMine(pax);
  }

  @UseGuards(PaxTokenGuard)
  @Delete("pax/moi/disponibilites/:id")
  deleteMine(@CurrentPax() pax: Pax, @Param("id") id: string) {
    return this.driverAvailabilityService.deleteMine(pax, id);
  }

  /** Back-office : toutes les disponibilités déclarées pour un évènement. */
  @UseGuards(AdminGuard)
  @Get("admin/disponibilites")
  findAllForEvent(@Query("eventId") eventId: string) {
    return this.driverAvailabilityService.findAllForEvent(eventId);
  }
}
