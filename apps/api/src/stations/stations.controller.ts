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
  UseGuards,
} from "@nestjs/common";
import type { Pax } from "@prisma/client";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { CurrentPax } from "../common/decorators/current-pax.decorator.js";
import { PaxTokenGuard } from "../common/guards/pax-token.guard.js";
import { EventsService } from "../events/events.service.js";
import { CreateStationDto } from "./dto/create-station.dto.js";
import { StationsService } from "./stations.service.js";

/**
 * Gares d'un évènement : lecture publique (le formulaire d'inscription en a
 * besoin avant même d'avoir un jeton), création par l'orga ou par un pax
 * (gare absente de la liste), suppression réservée à l'orga.
 */
@Controller()
export class StationsController {
  constructor(
    private readonly stationsService: StationsService,
    private readonly eventsService: EventsService,
  ) {}

  @Get("events/:eventId/stations")
  async findAllForEvent(@Param("eventId", ParseUUIDPipe) eventId: string) {
    await this.eventsService.findOne(eventId);
    return this.stationsService.findAllForEvent(eventId);
  }

  @UseGuards(PaxTokenGuard)
  @Post("pax/me/stations")
  createMine(@CurrentPax() pax: Pax, @Body() dto: CreateStationDto) {
    return this.stationsService.findOrCreate(pax.eventId, dto.name);
  }

  @UseGuards(AdminGuard)
  @Post("admin/events/:eventId/stations")
  async create(@Param("eventId", ParseUUIDPipe) eventId: string, @Body() dto: CreateStationDto) {
    await this.eventsService.findOne(eventId);
    return this.stationsService.findOrCreate(eventId, dto.name);
  }

  @UseGuards(AdminGuard)
  @Delete("admin/events/:eventId/stations/:stationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("stationId", ParseUUIDPipe) stationId: string,
  ) {
    return this.stationsService.remove(eventId, stationId);
  }
}
