import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentPax } from "../common/decorators/current-pax.decorator";
import { PaxTokenGuard } from "../common/guards/pax-token.guard";
import type { Pax } from "@prisma/client";
import { NavettesService } from "../navettes/navettes.service";
import { CreatePaxDto } from "./dto/create-pax.dto";
import { RechercherPaxDto } from "./dto/rechercher-pax.dto";
import { UpdatePaxDto } from "./dto/update-pax.dto";
import { PaxService } from "./pax.service";

@Controller()
export class PaxController {
  constructor(
    private readonly paxService: PaxService,
    private readonly navettesService: NavettesService,
  ) {}

  /** Première saisie, publique : n'importe qui avec le lien de l'évènement peut s'inscrire. */
  @Post("pax")
  create(@Body() dto: CreatePaxDto) {
    return this.paxService.create(dto);
  }

  /** Auto-service : le pax revient avec son lien personnel (en-tête x-pax-token). */
  @UseGuards(PaxTokenGuard)
  @Get("pax/moi")
  findMine(@CurrentPax() pax: Pax) {
    return this.paxService.findMine(pax);
  }

  @UseGuards(PaxTokenGuard)
  @Patch("pax/moi")
  updateMine(@CurrentPax() pax: Pax, @Body() dto: UpdatePaxDto) {
    return this.paxService.update(pax, dto);
  }

  /**
   * Planning des navettes de son évènement, en lecture seule : conducteur·ice,
   * véhicule, horaires, places restantes, et noms des co-passager·es (jamais
   * leurs coordonnées de contact — voir NavettesService.findAllForEventPourPax).
   */
  @UseGuards(PaxTokenGuard)
  @Get("pax/moi/navettes")
  navettesDeMonEvent(@CurrentPax() pax: Pax) {
    return this.navettesService.findAllForEventPourPax(pax.eventId);
  }

  /** Back-office : liste des paxs d'un évènement (inclut le jeton, pour renvoyer un lien perdu). */
  @UseGuards(AdminGuard)
  @Get("admin/pax")
  findAllForEvent(@Query("eventId") eventId: string) {
    return this.paxService.findAllForEvent(eventId);
  }

  /** Back-office : retrouver un pax par nom pour lui repartager son lien perdu. */
  @UseGuards(AdminGuard)
  @Get("admin/pax/rechercher")
  rechercher(@Query() query: RechercherPaxDto) {
    return this.paxService.rechercher(query.eventId, query.nom);
  }

  @UseGuards(AdminGuard)
  @Get("admin/pax/:id")
  findOneAdmin(@Param("id") id: string) {
    return this.paxService.findOneAdmin(id);
  }
}
