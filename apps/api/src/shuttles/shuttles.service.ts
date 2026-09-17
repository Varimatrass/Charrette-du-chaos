import { Injectable, NotFoundException } from "@nestjs/common";
import type { Shuttle } from "@prisma/client";
import { toDate } from "../common/utils/dates.js";
import { omitUndefined } from "../common/utils/objects.js";
import { computeWaitLevel } from "../common/utils/wait-level.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreateShuttleDto } from "./dto/create-shuttle.dto.js";
import { UpdateShuttleDto } from "./dto/update-shuttle.dto.js";

/** Tri chronologique commun à toutes les listes de navettes. */
const SHUTTLES_ORDER = [{ day: "asc" }, { departureTime: "asc" }] as const;

/** Places restantes = capacité − nombre de trajets assignés (jamais négatif à l'affichage). */
export function remainingSeats(capacity: number, assignedTrips: number): number {
  return capacity - assignedTrips;
}

@Injectable()
export class ShuttlesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateShuttleDto): Promise<Shuttle> {
    return this.prisma.shuttle.create({
      data: { ...dto, day: toDate(dto.day), driverPaxId: dto.driverPaxId || null },
    });
  }

  /** Back-office : navettes d'un évènement avec leurs places restantes. */
  async findAllForEvent(eventId: string) {
    const shuttles = await this.prisma.shuttle.findMany({
      where: { eventId },
      include: { _count: { select: { trips: true } } },
      orderBy: [...SHUTTLES_ORDER],
    });

    return shuttles.map(({ _count, ...shuttle }) => ({
      ...shuttle,
      remainingSeats: remainingSeats(shuttle.capacity, _count.trips),
    }));
  }

  /**
   * Planning pour les paxs : mêmes navettes que `findAllForEvent`, mais avec
   * en plus les noms de leurs co-passager·es (jamais l'email/téléphone —
   * voir le commentaire sur `PassengerName` dans shared-types). Dans un
   * évènement en autogestion, savoir qui conduit et qui est dans la navette
   * est utile aux paxs ; leurs coordonnées de contact restent privées entre
   * elleux.
   *
   * Exception ciblée : le téléphone du/de la conducteur·ice devient visible,
   * mais UNIQUEMENT pour les pax qui sont eux/elles-mêmes dans CETTE navette
   * précise (`requestingPaxId` parmi les passager·es), et seulement si un pax
   * est identifié comme conducteur·ice (`driverPaxId`). Tout le monde d'autre
   * continue à ne voir que son nom.
   */
  async findAllForEventAsPax(eventId: string, requestingPaxId: string) {
    const shuttles = await this.prisma.shuttle.findMany({
      where: { eventId },
      include: {
        trips: { select: { pax: { select: { id: true, name: true } } } },
        driverPax: { select: { contactPhone: true } },
      },
      orderBy: [...SHUTTLES_ORDER],
    });

    return shuttles.map(({ trips, driverPax, ...shuttle }) => {
      const passengers = trips.map(({ pax }) => ({ paxId: pax.id, name: pax.name }));
      const isPassenger = passengers.some((passenger) => passenger.paxId === requestingPaxId);

      return {
        ...shuttle,
        remainingSeats: remainingSeats(shuttle.capacity, trips.length),
        passengers,
        driverContactPhone: isPassenger ? (driverPax?.contactPhone ?? null) : null,
      };
    });
  }

  /** Back-office : une navette avec la liste complète de ses passager·es (coordonnées incluses). */
  async findOne(id: string) {
    const shuttle = await this.prisma.shuttle.findUnique({
      where: { id },
      include: { trips: { include: { pax: true } } },
    });
    if (!shuttle) throw new NotFoundException("Navette introuvable");

    const { trips, ...rest } = shuttle;
    const passengers = trips.map((trip) => ({
      ...trip,
      waitLevel: computeWaitLevel(trip.direction, trip.time, shuttle.stationArrivalTime),
    }));

    return {
      ...rest,
      passengers,
      remainingSeats: remainingSeats(shuttle.capacity, trips.length),
    };
  }

  async update(id: string, dto: UpdateShuttleDto): Promise<Shuttle> {
    await this.ensureExists(id);
    return this.prisma.shuttle.update({
      where: { id },
      data: omitUndefined({
        ...dto,
        day: dto.day === undefined ? undefined : toDate(dto.day),
        // Le lien vers un pax est une clé étrangère : contrairement aux
        // autres champs texte optionnels, une chaîne vide ne veut rien dire
        // pour Postgres — on la traite comme "délier" (null).
        driverPaxId: dto.driverPaxId === undefined ? undefined : dto.driverPaxId || null,
      }),
    });
  }

  private async ensureExists(id: string): Promise<void> {
    const shuttle = await this.prisma.shuttle.findUnique({ where: { id }, select: { id: true } });
    if (!shuttle) throw new NotFoundException("Navette introuvable");
  }
}
