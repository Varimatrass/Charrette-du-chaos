import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Car, Pax, Prisma } from "@prisma/client";
import type { Direction } from "@desordre/shared-types";
import type { CarOverview, PassengerName } from "@desordre/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { UpsertCarDto } from "./dto/upsert-car.dto.js";

const OVERVIEW_INCLUDE = {
  ownerPax: { select: { id: true, name: true } },
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
    owner: { id: car.ownerPax.id, name: car.ownerPax.name },
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

  /** Crée ou met à jour la voiture du pax (une seule par pax). */
  upsertMine(pax: Pax, dto: UpsertCarDto): Promise<Car> {
    return this.prisma.car.upsert({
      where: { ownerPaxId: pax.id },
      create: { eventId: pax.eventId, ownerPaxId: pax.id, ...dto },
      update: dto,
    });
  }

  /**
   * Supprime la voiture du pax. Les trajets des passager·es qui y étaient
   * repassent à "cherche un covoit" (la FK est en SET NULL, on remet le flag).
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
    ]);
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
