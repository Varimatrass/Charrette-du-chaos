import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Pax } from "@prisma/client";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentPax } from "../common/decorators/current-pax.decorator";
import { EventIdQueryDto } from "../common/dto/event-id-query.dto";
import { PaxTokenGuard } from "../common/guards/pax-token.guard";
import { ShuttlesService } from "../shuttles/shuttles.service";
import { TripsService } from "../trips/trips.service";
import { CreatePaxDto } from "./dto/create-pax.dto";
import { SearchPaxDto } from "./dto/search-pax.dto";
import { UpdatePaxDto } from "./dto/update-pax.dto";
import { PaxService } from "./pax.service";

/**
 * Parcours pax : inscription publique, puis auto-service via le lien
 * personnel (`x-pax-token`) sous `/pax/me/...`. Les routes back-office sont
 * sous `/admin/pax/...`.
 */
@Controller()
export class PaxController {
  constructor(
    private readonly paxService: PaxService,
    private readonly shuttlesService: ShuttlesService,
    private readonly tripsService: TripsService,
  ) {}

  /** Première saisie, publique : n'importe qui avec le lien de l'évènement peut s'inscrire. */
  @Post("pax")
  create(@Body() dto: CreatePaxDto) {
    return this.paxService.create(dto);
  }

  /** Auto-service : le pax revient avec son lien personnel (en-tête x-pax-token). */
  @UseGuards(PaxTokenGuard)
  @Get("pax/me")
  findMine(@CurrentPax() pax: Pax) {
    return this.paxService.findMine(pax);
  }

  @UseGuards(PaxTokenGuard)
  @Patch("pax/me")
  updateMine(@CurrentPax() pax: Pax, @Body() dto: UpdatePaxDto) {
    return this.paxService.update(pax, dto);
  }

  /**
   * Planning des navettes de son évènement, en lecture seule : conducteur·ice,
   * véhicule, horaires, places restantes, et noms des co-passager·es (jamais
   * leurs coordonnées de contact — voir ShuttlesService.findAllForEventAsPax).
   * Exception : le téléphone du/de la conducteur·ice devient visible, mais
   * seulement pour les pax qui sont dans CETTE navette (d'où le `pax.id`
   * passé ici, pour que le service sache qui demande).
   */
  @UseGuards(PaxTokenGuard)
  @Get("pax/me/shuttles")
  findMyEventShuttles(@CurrentPax() pax: Pax) {
    return this.shuttlesService.findAllForEventAsPax(pax.eventId, pax.id);
  }

  /**
   * Annuaire des paxs de son évènement, en lecture seule : jamais les
   * coordonnées de contact (email/téléphone) ni le jeton d'accès des autres.
   */
  @UseGuards(PaxTokenGuard)
  @Get("pax/me/paxs")
  findMyEventPaxs(@CurrentPax() pax: Pax) {
    return this.paxService.findAllForEventOverview(pax.eventId);
  }

  /**
   * Tous les trajets de son évènement, en lecture seule : jamais les
   * coordonnées des autres paxs, ni le commentaire interne d'un trajet ou
   * d'une navette (réservés à l'organisation).
   */
  @UseGuards(PaxTokenGuard)
  @Get("pax/me/trips")
  findMyEventTrips(@CurrentPax() pax: Pax) {
    return this.tripsService.findAllForEventOverview(pax.eventId);
  }

  /** Back-office : liste des paxs d'un évènement (inclut le jeton, pour renvoyer un lien perdu). */
  @UseGuards(AdminGuard)
  @Get("admin/pax")
  findAllForEvent(@Query() query: EventIdQueryDto) {
    return this.paxService.findAllForEvent(query.eventId);
  }

  /** Back-office : retrouver un pax par nom pour lui repartager son lien perdu. */
  @UseGuards(AdminGuard)
  @Get("admin/pax/search")
  search(@Query() query: SearchPaxDto) {
    return this.paxService.search(query.eventId, query.name);
  }

  @UseGuards(AdminGuard)
  @Get("admin/pax/:id")
  findOneAdmin(@Param("id", ParseUUIDPipe) id: string) {
    return this.paxService.findOneAdmin(id);
  }
}
