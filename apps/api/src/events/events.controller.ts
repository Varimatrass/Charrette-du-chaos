import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard.js";
import { CreateEventDto } from "./dto/create-event.dto.js";
import { UpdateEventDto } from "./dto/update-event.dto.js";
import { EventsService } from "./events.service.js";

/**
 * Les évènements n'ont rien de sensible (nom, dates, lieu, gares) : lecture
 * publique pour que la page d'accueil et le formulaire pax puissent afficher
 * le contexte. La liste publique ne montre que les évènements ouverts aux
 * paxs ; un évènement précis reste accessible par son lien direct.
 * Écriture réservée aux organisateur·ices.
 */
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get("events")
  findOpen() {
    return this.eventsService.findOpen();
  }

  @Get("events/:id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(id);
  }

  @UseGuards(AdminGuard)
  @Get("admin/events")
  findAll() {
    return this.eventsService.findAll();
  }

  @UseGuards(AdminGuard)
  @Post("admin/events")
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch("admin/events/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }
}
