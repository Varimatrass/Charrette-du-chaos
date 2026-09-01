import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEditionDto } from "./dto/create-edition.dto";
import { UpdateEditionDto } from "./dto/update-edition.dto";

@Injectable()
export class EditionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEditionDto) {
    return this.prisma.edition.create({
      data: {
        nom: dto.nom,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        lieu: dto.lieu,
        gareReference: dto.gareReference,
      },
    });
  }

  findAll() {
    return this.prisma.edition.findMany({ orderBy: { dateDebut: "desc" } });
  }

  async findOne(id: string) {
    const edition = await this.prisma.edition.findUnique({ where: { id } });
    if (!edition) throw new NotFoundException("Édition introuvable");
    return edition;
  }

  async update(id: string, dto: UpdateEditionDto) {
    await this.findOne(id);
    return this.prisma.edition.update({
      where: { id },
      data: {
        ...(dto.nom !== undefined && { nom: dto.nom }),
        ...(dto.dateDebut !== undefined && { dateDebut: new Date(dto.dateDebut) }),
        ...(dto.dateFin !== undefined && { dateFin: new Date(dto.dateFin) }),
        ...(dto.lieu !== undefined && { lieu: dto.lieu }),
        ...(dto.gareReference !== undefined && { gareReference: dto.gareReference }),
      },
    });
  }
}
