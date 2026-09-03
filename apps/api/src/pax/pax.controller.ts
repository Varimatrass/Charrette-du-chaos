import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentPax } from "../common/decorators/current-pax.decorator";
import { PaxTokenGuard } from "../common/guards/pax-token.guard";
import type { Pax } from "@prisma/client";
import { CreatePaxDto } from "./dto/create-pax.dto";
import { RechercherPaxDto } from "./dto/rechercher-pax.dto";
import { UpdatePaxDto } from "./dto/update-pax.dto";
import { PaxService } from "./pax.service";

@Controller()
export class PaxController {
  constructor(private readonly paxService: PaxService) {}

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
