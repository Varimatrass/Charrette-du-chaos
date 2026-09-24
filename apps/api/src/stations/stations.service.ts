import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Station } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

/** Normalise un nom de gare saisi : espaces superflus retirés. */
export function normalizeStationName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForEvent(eventId: string): Promise<Station[]> {
    return this.prisma.station.findMany({ where: { eventId }, orderBy: { name: "asc" } });
  }

  /**
   * Trouve la gare par son nom dans l'évènement, ou la crée. Utilisé aussi
   * bien par l'orga (page de config) que par un pax qui tape une gare
   * absente de la liste : deux saisies du même nom donnent la même gare.
   *
   * Sûr en concurrence : si deux requêtes créent le même nom en même temps,
   * `skipDuplicates` (ON CONFLICT DO NOTHING) laisse passer la seconde sans
   * erreur, et elle relit la gare créée par la première. `db` permet de
   * l'appeler depuis une transaction en cours.
   */
  async findOrCreate(
    eventId: string,
    rawName: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Station> {
    const name = normalizeStationName(rawName);
    if (!name) throw new BadRequestException("Le nom de la gare est vide");
    const where = { eventId_name: { eventId, name } };
    const existing = await db.station.findUnique({ where });
    if (existing) return existing;
    await db.station.createMany({ data: [{ eventId, name }], skipDuplicates: true });
    return db.station.findUniqueOrThrow({ where });
  }

  /** Vérifie qu'une gare existe et appartient bien à l'évènement. */
  async ensureInEvent(
    eventId: string,
    stationId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Station> {
    const station = await db.station.findUnique({ where: { id: stationId } });
    if (!station || station.eventId !== eventId) {
      throw new BadRequestException("Cette gare n'appartient pas à cet évènement");
    }
    return station;
  }

  /** Supprime une gare ; les trajets qui la référençaient repassent à "gare non renseignée". */
  async remove(eventId: string, stationId: string): Promise<void> {
    const station = await this.prisma.station.findUnique({ where: { id: stationId } });
    if (!station || station.eventId !== eventId) throw new NotFoundException("Gare introuvable");
    await this.prisma.station.delete({ where: { id: stationId } });
  }
}
