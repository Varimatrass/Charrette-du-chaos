import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventsService } from "./events.service";

/**
 * Les évènements n'ont rien de sensible (nom, dates, lieu) : lecture publique
 * pour que le formulaire pax puisse afficher le contexte de l'évènement.
 * Écriture réservée aux organisateur·ices.
 */
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get("events")
  findAll() {
    return this.eventsService.findAll();
  }

  @Get("events/:id")
  findOne(@Param("id") id: string) {
    return this.eventsService.findOne(id);
  }

  // Écriture réservée aux organisateur·ices : sous /admin/... comme les autres
  // routes protégées par AdminGuard (pax, navettes, trajets), pour que
  // l'intercepteur front qui attache x-admin-key (basé sur "/admin/" dans
  // l'URL) s'applique automatiquement.
  @UseGuards(AdminGuard)
  @Post("admin/events")
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch("admin/events/:id")
  update(@Param("id") id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }
}
