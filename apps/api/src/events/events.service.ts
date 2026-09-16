import { Injectable, NotFoundException } from "@nestjs/common";
import type { Event } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { toDate } from "../common/utils/dates";
import { omitUndefined } from "../common/utils/objects";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEventDto): Promise<Event> {
    return this.prisma.event.create({
      data: {
        name: dto.name,
        startDate: toDate(dto.startDate),
        endDate: toDate(dto.endDate),
        location: dto.location,
        referenceStation: dto.referenceStation,
      },
    });
  }

  findAll(): Promise<Event[]> {
    return this.prisma.event.findMany({ orderBy: { startDate: "desc" } });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException("Évènement introuvable");
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    await this.findOne(id);
    return this.prisma.event.update({
      where: { id },
      data: omitUndefined({
        name: dto.name,
        startDate: dto.startDate === undefined ? undefined : toDate(dto.startDate),
        endDate: dto.endDate === undefined ? undefined : toDate(dto.endDate),
        location: dto.location,
        referenceStation: dto.referenceStation,
      }),
    });
  }
}
