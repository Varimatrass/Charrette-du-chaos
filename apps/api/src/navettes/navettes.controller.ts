import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard";
import { CreateNavetteDto } from "./dto/create-navette.dto";
import { UpdateNavetteDto } from "./dto/update-navette.dto";
import { NavettesService } from "./navettes.service";

/** Tout ce qui concerne les navettes (avec noms des passager·es) reste réservé au back-office. */
@UseGuards(AdminGuard)
@Controller("admin/navettes")
export class NavettesController {
  constructor(private readonly navettesService: NavettesService) {}

  @Post()
  create(@Body() dto: CreateNavetteDto) {
    return this.navettesService.create(dto);
  }

  @Get()
  findAllForEvent(@Query("eventId") eventId: string) {
    return this.navettesService.findAllForEvent(eventId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.navettesService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateNavetteDto) {
    return this.navettesService.update(id, dto);
  }
}
