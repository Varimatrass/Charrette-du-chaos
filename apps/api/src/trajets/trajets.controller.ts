import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Pax } from "@prisma/client";
import { Sens, StatutTrajet } from "@desordre/shared-types";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentPax } from "../common/decorators/current-pax.decorator";
import { PaxTokenGuard } from "../common/guards/pax-token.guard";
import { AssignerTrajetDto } from "./dto/assigner-trajet.dto";
import { SetStatutTrajetDto } from "./dto/set-statut-trajet.dto";
import { UpsertTrajetDto } from "./dto/upsert-trajet.dto";
import { TrajetsService } from "./trajets.service";

@Controller()
export class TrajetsController {
  constructor(private readonly trajetsService: TrajetsService) {}

  @UseGuards(PaxTokenGuard)
  @Put("pax/moi/trajets/:sens")
  upsertMine(
    @CurrentPax() pax: Pax,
    @Param("sens", new ParseEnumPipe(Sens)) sens: Sens,
    @Body() dto: UpsertTrajetDto,
  ) {
    return this.trajetsService.upsertMine(pax, sens, dto);
  }

  @UseGuards(AdminGuard)
  @Get("admin/trajets")
  findAllForEdition(@Query("editionId") editionId: string, @Query("statut") statut?: StatutTrajet) {
    return this.trajetsService.findAllForEdition(editionId, statut);
  }

  @UseGuards(AdminGuard)
  @Patch("admin/trajets/:id/assigner")
  assigner(@Param("id") id: string, @Body() dto: AssignerTrajetDto) {
    return this.trajetsService.assigner(id, dto);
  }

  @UseGuards(AdminGuard)
  @Patch("admin/trajets/:id/statut")
  setStatut(@Param("id") id: string, @Body() dto: SetStatutTrajetDto) {
    return this.trajetsService.setStatut(id, dto);
  }
}
