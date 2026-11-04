import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Direction, IncompatiblePassenger } from "@desordre/shared-types";
import type { Prisma, Shuttle } from "@prisma/client";
import { frenchEventRange, isoDay, isWithinEvent, toDate } from "../common/utils/dates.js";
import { omitUndefined } from "../common/utils/objects.js";
import { computeWaitLevel } from "../common/utils/wait-level.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreateShuttleDto } from "./dto/create-shuttle.dto.js";
import { UpdateShuttleDto } from "./dto/update-shuttle.dto.js";

/** Tri chronologique commun à toutes les listes de navettes. */
const SHUTTLES_ORDER = [{ day: "asc" }, { departureTime: "asc" }] as const;

/** Ce qu'on expose du/de la conducteur·ice dans les listes : juste de quoi l'identifier. */
const DRIVER_SELECT = { select: { id: true, name: true } } as const;

/**
 * Places restantes = capacité − nombre de trajets assignés. Négatif quand
 * l'orga a surbooké la navette (permis, mais affiché en rouge).
 */
export function remainingSeats(capacity: number, assignedTrips: number): number {
  return capacity - assignedTrips;
}

@Injectable()
export class ShuttlesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShuttleDto): Promise<Shuttle> {
    await this.ensureDayInEvent(dto.eventId, toDate(dto.day));
    const driverPaxId = dto.driverPaxId || null;
    if (driverPaxId) await this.ensureDriverInEvent(dto.eventId, driverPaxId);
    return this.prisma.shuttle.create({
      data: { ...dto, day: toDate(dto.day), driverPaxId },
    });
  }

  /** Navettes d'un évènement avec leurs places restantes et leur conducteur·ice (nom). */
  async findAllForEvent(eventId: string) {
    const shuttles = await this.prisma.shuttle.findMany({
      where: { eventId },
      include: { _count: { select: { trips: true } }, driverPax: DRIVER_SELECT },
      orderBy: [...SHUTTLES_ORDER],
    });

    return shuttles.map(({ _count, ...shuttle }) => ({
      ...shuttle,
      remainingSeats: remainingSeats(shuttle.capacity, _count.trips),
    }));
  }

  /** Une navette avec ses places restantes, ou `null` — pour les contrôles d'assignation. */
  async findOneWithSeats(id: string, db: Prisma.TransactionClient = this.prisma) {
    const shuttle = await db.shuttle.findUnique({
      where: { id },
      include: { _count: { select: { trips: true } } },
    });
    if (!shuttle) return null;
    const { _count, ...rest } = shuttle;
    return { ...rest, remainingSeats: remainingSeats(shuttle.capacity, _count.trips) };
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
        driverPax: { select: { id: true, name: true, contactPhone: true } },
      },
      orderBy: [...SHUTTLES_ORDER],
    });

    return shuttles.map(({ trips, driverPax, ...shuttle }) => {
      const passengers = trips.map(({ pax }) => ({ paxId: pax.id, name: pax.name }));
      const isPassenger = passengers.some((passenger) => passenger.paxId === requestingPaxId);

      return {
        ...shuttle,
        driverPax: driverPax ? { id: driverPax.id, name: driverPax.name } : null,
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
      include: { trips: { include: { pax: true, station: true } }, driverPax: DRIVER_SELECT },
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

  /**
   * Modifie une navette. Si la modif rend des passager·es incompatibles
   * (autre sens, autre jour que leur trajet, plus assez de places), rien
   * n'est enregistré et on répond 409 avec la liste ; l'orga confirme en
   * renvoyant `removeIncompatible: true`, et ces passager·es sont retiré·es
   * (leur trajet repasse "en attente").
   */
  async update(id: string, dto: UpdateShuttleDto): Promise<Shuttle> {
    const { removeIncompatible, ...changes } = dto;
    const shuttle = await this.prisma.shuttle.findUnique({
      where: { id },
      include: {
        trips: {
          select: { id: true, day: true, shuttleAssignedAt: true, pax: { select: { name: true } } },
        },
      },
    });
    if (!shuttle) throw new NotFoundException("Navette introuvable");
    if (changes.driverPaxId) await this.ensureDriverInEvent(shuttle.eventId, changes.driverPaxId);
    if (changes.day !== undefined)
      await this.ensureDayInEvent(shuttle.eventId, toDate(changes.day));

    const incompatible = findIncompatiblePassengers(shuttle, {
      direction: changes.direction,
      day: changes.day === undefined ? undefined : toDate(changes.day),
      capacity: changes.capacity,
    });
    if (incompatible.length > 0 && !removeIncompatible) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cette modification ne laisse plus de place à ${incompatible.length} passager·e${incompatible.length > 1 ? "s" : ""}.`,
        incompatible,
      });
    }

    const data = omitUndefined({
      ...changes,
      day: changes.day === undefined ? undefined : toDate(changes.day),
      // Le lien vers un pax est une clé étrangère : contrairement aux
      // autres champs texte optionnels, une chaîne vide ne veut rien dire
      // pour Postgres — on la traite comme "délier" (null).
      driverPaxId: changes.driverPaxId === undefined ? undefined : changes.driverPaxId || null,
    });

    if (incompatible.length === 0) return this.prisma.shuttle.update({ where: { id }, data });
    const [, updated] = await this.prisma.$transaction([
      this.prisma.trip.updateMany({
        where: { id: { in: incompatible.map((p) => p.tripId) } },
        data: { shuttleId: null, shuttleAssignedAt: null, status: "PENDING" },
      }),
      this.prisma.shuttle.update({ where: { id }, data }),
    ]);
    return updated;
  }

  /** Une navette roule pendant l'évènement. */
  private async ensureDayInEvent(eventId: string, day: Date): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { startDate: true, endDate: true },
    });
    if (!event) throw new BadRequestException("Cet évènement n'existe pas");
    if (!isWithinEvent(event, day)) {
      throw new BadRequestException(
        `Une navette doit rouler pendant l'évènement (${frenchEventRange(event)})`,
      );
    }
  }

  /** Le/la conducteur·ice doit être un pax de l'évènement de la navette. */
  private async ensureDriverInEvent(eventId: string, paxId: string): Promise<void> {
    const pax = await this.prisma.pax.findUnique({
      where: { id: paxId },
      select: { eventId: true },
    });
    if (!pax || pax.eventId !== eventId) {
      throw new BadRequestException("Le/la conducteur·ice doit être un pax de cet évènement");
    }
  }
}

interface ShuttlePassengersSnapshot {
  direction: Direction;
  day: Date;
  capacity: number;
  trips: { id: string; day: Date | null; shuttleAssignedAt: Date | null; pax: { name: string } }[];
}

/**
 * Passager·es qui ne tiendraient plus dans la navette après modification :
 * tout le monde si le sens change ; celleux dont le trajet est un autre jour
 * si le jour change ; puis, s'il reste plus de monde que de places, les
 * dernier·es entré·es dans la navette.
 */
export function findIncompatiblePassengers(
  shuttle: ShuttlePassengersSnapshot,
  changes: { direction?: Direction; day?: Date; capacity?: number },
): IncompatiblePassenger[] {
  const toPassenger = (
    trip: ShuttlePassengersSnapshot["trips"][number],
    reason: IncompatiblePassenger["reason"],
  ) => ({ tripId: trip.id, paxName: trip.pax.name, reason });

  if (changes.direction !== undefined && changes.direction !== shuttle.direction) {
    return shuttle.trips.map((trip) => toPassenger(trip, "DIRECTION"));
  }

  const result: IncompatiblePassenger[] = [];
  let remaining = shuttle.trips;
  const newDay = changes.day;
  if (newDay && isoDay(newDay) !== isoDay(shuttle.day)) {
    const wrongDay = (trip: (typeof remaining)[number]) =>
      trip.day !== null && isoDay(trip.day) !== isoDay(newDay);
    result.push(...remaining.filter(wrongDay).map((trip) => toPassenger(trip, "DAY")));
    remaining = remaining.filter((trip) => !wrongDay(trip));
  }

  const capacity = changes.capacity ?? shuttle.capacity;
  if (changes.capacity !== undefined && remaining.length > capacity) {
    const lastIn = [...remaining].sort(
      (a, b) => (b.shuttleAssignedAt?.getTime() ?? 0) - (a.shuttleAssignedAt?.getTime() ?? 0),
    );
    result.push(
      ...lastIn.slice(0, remaining.length - capacity).map((trip) => toPassenger(trip, "CAPACITY")),
    );
  }
  return result;
}
