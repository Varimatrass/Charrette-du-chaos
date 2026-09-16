import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Pax } from "@prisma/client";
import { Direction } from "@desordre/shared-types";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentPax } from "../common/decorators/current-pax.decorator";
import { PaxTokenGuard } from "../common/guards/pax-token.guard";
import { AssignTripDto } from "./dto/assign-trip.dto";
import { ListTripsQueryDto } from "./dto/list-trips-query.dto";
import { SetTripStatusDto } from "./dto/set-trip-status.dto";
import { UpsertTripDto } from "./dto/upsert-trip.dto";
import { TripsService } from "./trips.service";
import { ParseEnumValuePipe } from "../common/pipes/parse-enum-value.pipe";

@Controller()
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @UseGuards(PaxTokenGuard)
  @Put("pax/me/trips/:direction")
  upsertMine(
    @CurrentPax() pax: Pax,
    @Param("direction", new ParseEnumValuePipe(Direction)) direction: Direction,
    @Body() dto: UpsertTripDto,
  ) {
    return this.tripsService.upsertMine(pax, direction, dto);
  }

  @UseGuards(AdminGuard)
  @Get("admin/trips")
  findAllForEvent(@Query() query: ListTripsQueryDto) {
    return this.tripsService.findAllForEvent(query.eventId, query.status);
  }

  @UseGuards(AdminGuard)
  @Patch("admin/trips/:id/assign")
  assign(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AssignTripDto) {
    return this.tripsService.assign(id, dto);
  }

  @UseGuards(AdminGuard)
  @Patch("admin/trips/:id/status")
  setStatus(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetTripStatusDto) {
    return this.tripsService.setStatus(id, dto);
  }
}
