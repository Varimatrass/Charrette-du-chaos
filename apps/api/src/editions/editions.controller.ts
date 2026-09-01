import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard";
import { CreateEditionDto } from "./dto/create-edition.dto";
import { UpdateEditionDto } from "./dto/update-edition.dto";
import { EditionsService } from "./editions.service";

/**
 * Les éditions n'ont rien de sensible (nom, dates, lieu) : lecture publique
 * pour que le formulaire pax puisse afficher le contexte de l'évènement.
 * Écriture réservée aux organisateur·ices.
 */
@Controller("editions")
export class EditionsController {
  constructor(private readonly editionsService: EditionsService) {}

  @Get()
  findAll() {
    return this.editionsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.editionsService.findOne(id);
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateEditionDto) {
    return this.editionsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEditionDto) {
    return this.editionsService.update(id, dto);
  }
}
