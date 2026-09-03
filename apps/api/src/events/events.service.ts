import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEventDto) {
    return this.prisma.event.create({
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
    return this.prisma.event.findMany({ orderBy: { dateDebut: "desc" } });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException("Évènement introuvable");
    return event;
  }

  async update(id: string, dto: UpdateEventDto) {
    await this.findOne(id);
    return this.prisma.event.update({
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
