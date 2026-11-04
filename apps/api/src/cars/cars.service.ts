import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Car, Pax, Prisma } from "@prisma/client";
import { Direction, type VehicleLendingMode } from "@desordre/shared-types";
import type { CarOverview, PassengerName } from "@desordre/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { UpsertCarDto } from "./dto/upsert-car.dto.js";

const OVERVIEW_INCLUDE = {
  ownerPax: { select: { id: true, name: true } },
  _count: { select: { shuttles: true } },
  trips: {
    select: { direction: true, carpoolRole: true, pax: { select: { id: true, name: true } } },
  },
} satisfies Prisma.CarInclude;

type CarWithTrips = Prisma.CarGetPayload<{ include: typeof OVERVIEW_INCLUDE }>;

/** Les passager·es d'une voiture sont les trajets PASSENGER qui la référencent, par direction. */
export function toCarOverview(car: CarWithTrips): CarOverview {
  const passengers: Record<Direction, PassengerName[]> = { OUTBOUND: [], RETURN: [] };
  for (const trip of car.trips) {
    if (trip.carpoolRole !== "PASSENGER") continue;
    passengers[trip.direction].push({ paxId: trip.pax.id, name: trip.pax.name });
  }
  return {
    id: car.id,
    name: car.name,
    seats: car.seats,
    lendingMode: car.lendingMode,
    owner: car.ownerPax ? { id: car.ownerPax.id, name: car.ownerPax.name } : null,
    isShuttleVehicle: car._count.shuttles > 0,
    passengers,
    remainingSeats: {
      OUTBOUND: car.seats - passengers.OUTBOUND.length,
      RETURN: car.seats - passengers.RETURN.length,
    },
  };
}

@Injectable()
export class CarsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour la voiture du pax (une seule par pax). On ne peut pas
   * descendre sous le nombre de passager·es déjà déclaré·es dans un sens :
   * il faut d'abord qu'iels changent de voiture.
   */
  async upsertMine(pax: Pax, dto: UpsertCarDto): Promise<Car> {
    const existing = await this.prisma.car.findUnique({
      where: { ownerPaxId: pax.id },
      include: OVERVIEW_INCLUDE,
    });
    if (existing) {
      const { passengers } = toCarOverview(existing);
      for (const direction of [Direction.OUTBOUND, Direction.RETURN]) {
        const names = passengers[direction].map((p) => p.name);
        if (names.length > dto.seats) {
          throw new BadRequestException(
            `Ta voiture a déjà ${names.length} passager·e${names.length > 1 ? "s" : ""} ${direction === Direction.OUTBOUND ? "à l'aller" : "au retour"} (${names.join(", ")}) : tu ne peux pas descendre à ${dto.seats} place${dto.seats > 1 ? "s" : ""}. Demande-leur de changer de voiture d'abord.`,
          );
        }
      }
    }
    return this.prisma.car.upsert({
      where: { ownerPaxId: pax.id },
      create: { eventId: pax.eventId, ownerPaxId: pax.id, ...dto },
      update: dto,
    });
  }

  /**
   * Supprime la voiture du pax. Les trajets des passager·es qui y étaient
   * repassent à "cherche un covoit" (la FK est en SET NULL, on remet le flag),
   * et le pax n'a plus de véhicule.
   */
  async deleteMine(pax: Pax): Promise<void> {
    const car = await this.prisma.car.findUnique({ where: { ownerPaxId: pax.id } });
    if (!car) throw new NotFoundException("Tu n'as pas déclaré de voiture");
    await this.prisma.$transaction([
      this.prisma.trip.updateMany({
        where: { carId: car.id, carpoolRole: "PASSENGER" },
        data: { lookingForCarpool: true },
      }),
      this.prisma.trip.updateMany({
        where: { carId: car.id, carpoolRole: "DRIVER" },
        data: { carpoolRole: null },
      }),
      this.prisma.car.delete({ where: { id: car.id } }),
      // Plus de voiture déclarée : "a un véhicule" repasse à non (B11).
      this.prisma.pax.update({ where: { id: pax.id }, data: { hasVehicle: false } }),
    ]);
  }

  /**
   * Voiture sans propriétaire : celle d'un·e conducteur·ice pas inscrit·e
   * (déclarée par un·e de ses passager·es) ou un véhicule de l'orga pour une
   * navette. Si une voiture sans propriétaire porte déjà ce nom dans
   * l'évènement, on la reprend : deux passager·es de la même voiture qui
   * tapent le même nom se retrouvent dedans ensemble.
   */
  async findOrCreateOwnerless(
    eventId: string,
    rawName: string,
    seats: number,
    lendingMode: VehicleLendingMode,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Car> {
    const name = normalizeCarName(rawName);
    if (!name) throw new BadRequestException("Le nom de la voiture est vide");
    const existing = await db.car.findFirst({
      where: { eventId, ownerPaxId: null, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return existing;
    return db.car.create({ data: { eventId, ownerPaxId: null, name, seats, lendingMode } });
  }

  /**
   * Un pax revendique une voiture sans propriétaire ("c'est la mienne") : iel
   * en devient le/la propriétaire. S'iel s'y était déclaré·e passager·e, iel
   * en devient le/la conducteur·ice pour ces trajets.
   */
  async claim(pax: Pax, carId: string): Promise<Car> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cars WHERE id = ${carId} FOR UPDATE`;
      const car = await tx.car.findUnique({ where: { id: carId } });
      if (!car || car.eventId !== pax.eventId) {
        throw new NotFoundException("Cette voiture n'existe pas dans cet évènement");
      }
      if (car.ownerPaxId) throw new BadRequestException("Cette voiture a déjà un·e propriétaire");
      if (await tx.car.findUnique({ where: { ownerPaxId: pax.id } })) {
        throw new BadRequestException(
          "Tu as déjà une voiture déclarée : retire-la d'abord si c'est celle-ci",
        );
      }
      await tx.trip.updateMany({
        where: { paxId: pax.id, carId, carpoolRole: "PASSENGER" },
        data: { carpoolRole: "DRIVER", lookingForCarpool: false },
      });
      await tx.pax.update({ where: { id: pax.id }, data: { hasVehicle: true } });
      return tx.car.update({ where: { id: carId }, data: { ownerPaxId: pax.id } });
    });
  }

  /** Toutes les voitures de l'évènement, avec les places restantes par direction. */
  async findAllForEventOverview(eventId: string): Promise<CarOverview[]> {
    const cars = await this.prisma.car.findMany({
      where: { eventId },
      include: OVERVIEW_INCLUDE,
      orderBy: { name: "asc" },
    });
    return cars.map(toCarOverview);
  }

  /**
   * Vérifie qu'un pax peut se déclarer passager·e de cette voiture pour cette
   * direction : même évènement, pas sa propre voiture, et une place libre
   * (ou déjà dedans).
   *
   * À appeler dans la transaction qui écrit ensuite le trajet (`db`) : la
   * ligne de la voiture est verrouillée (FOR UPDATE) jusqu'à la fin de
   * celle-ci, donc deux paxs qui visent la dernière place passent l'un après
   * l'autre et le/la second·e voit la voiture pleine.
   */
  async ensureSeatAvailable(
    pax: Pax,
    carId: string,
    direction: Direction,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Car> {
    await db.$queryRaw`SELECT id FROM cars WHERE id = ${carId} FOR UPDATE`;
    const car = await db.car.findUnique({
      where: { id: carId },
      include: OVERVIEW_INCLUDE,
    });
    if (!car || car.eventId !== pax.eventId) {
      throw new BadRequestException("Cette voiture n'existe pas dans cet évènement");
    }
    if (car.ownerPaxId === pax.id) {
      throw new BadRequestException("Tu ne peux pas être passager·e de ta propre voiture");
    }
    const overview = toCarOverview(car);
    const alreadyIn = overview.passengers[direction].some((p) => p.paxId === pax.id);
    if (!alreadyIn && overview.remainingSeats[direction] <= 0) {
      throw new BadRequestException("Cette voiture est déjà pleine pour ce trajet");
    }
    return car;
  }
}

/** Normalise un nom de voiture saisi : espaces superflus retirés. */
export function normalizeCarName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}
