import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Event, Station } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { toDate } from "../common/utils/dates.js";
import { omitUndefined } from "../common/utils/objects.js";
import { CreateEventDto } from "./dto/create-event.dto.js";
import { UpdateEventDto } from "./dto/update-event.dto.js";

export type EventWithStations = Event & { stations: Station[] };

const WITH_STATIONS = { stations: { orderBy: { name: "asc" as const } } };

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée l'évènement et ses gares ; la première gare devient la gare préférée. */
  async create(dto: CreateEventDto): Promise<EventWithStations> {
    const stationNames = uniqueStationNames(dto.stations ?? []);
    const event = await this.prisma.event.create({
      data: {
        name: dto.name,
        startDate: toDate(dto.startDate),
        endDate: toDate(dto.endDate),
        location: dto.location,
        stations: { create: stationNames.map((name) => ({ name })) },
      },
      include: WITH_STATIONS,
    });

    const preferred = event.stations.find((station) => station.name === stationNames[0]);
    if (!preferred) return event;
    return this.prisma.event.update({
      where: { id: event.id },
      data: { preferredStationId: preferred.id },
      include: WITH_STATIONS,
    });
  }

  /** Liste publique : seulement les évènements que l'orga a ouverts aux paxs. */
  findOpen(): Promise<EventWithStations[]> {
    return this.prisma.event.findMany({
      where: { openToPaxs: true },
      orderBy: { startDate: "desc" },
      include: WITH_STATIONS,
    });
  }

  /** Back-office : tous les évènements, ouverts ou pas. */
  findAll(): Promise<EventWithStations[]> {
    return this.prisma.event.findMany({ orderBy: { startDate: "desc" }, include: WITH_STATIONS });
  }

  async findOne(id: string): Promise<EventWithStations> {
    const event = await this.prisma.event.findUnique({ where: { id }, include: WITH_STATIONS });
    if (!event) throw new NotFoundException("Évènement introuvable");
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventWithStations> {
    const event = await this.findOne(id);
    if (dto.preferredStationId && !event.stations.some((s) => s.id === dto.preferredStationId)) {
      throw new BadRequestException("La gare préférée doit être une gare de cet évènement");
    }
    return this.prisma.event.update({
      where: { id },
      data: omitUndefined({
        name: dto.name,
        startDate: dto.startDate === undefined ? undefined : toDate(dto.startDate),
        endDate: dto.endDate === undefined ? undefined : toDate(dto.endDate),
        location: dto.location,
        openToPaxs: dto.openToPaxs,
        preferredStationId: dto.preferredStationId,
      }),
      include: WITH_STATIONS,
    });
  }
}

function uniqueStationNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}
