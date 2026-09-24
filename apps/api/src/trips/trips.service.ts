import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Pax, Prisma, Trip } from "@prisma/client";
import { CarpoolRole, Direction, TransportMode, TripStatus } from "@desordre/shared-types";
import { toDateOrNull } from "../common/utils/dates.js";
import { computeWaitLevel } from "../common/utils/wait-level.js";
import { CarsService } from "../cars/cars.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ShuttlesService } from "../shuttles/shuttles.service.js";
import { StationsService } from "../stations/stations.service.js";
import { AssignTripDto } from "./dto/assign-trip.dto.js";
import { SetMyShuttleDto } from "./dto/set-my-shuttle.dto.js";
import { SetTripStatusDto } from "./dto/set-trip-status.dto.js";
import { UpsertTripDto } from "./dto/upsert-trip.dto.js";

/** Tri chronologique commun à toutes les listes de trajets. */
const TRIPS_ORDER = [{ day: "asc" }, { time: "asc" }] as const;

/**
 * Statut d'un trajet après une modification par le pax : s'il était déjà
 * assigné à une navette, on ne casse pas l'assignation mais on la marque
 * "à revérifier" pour l'organisateur·ice. Les autres statuts ne bougent pas.
 */
export function statusAfterPaxEdit(current: TripStatus): TripStatus {
  return current === TripStatus.ASSIGNED ? TripStatus.TO_RECHECK : current;
}

/** Champs d'un trajet qui dépendent du mode de transport, remis à plat. */
interface ModeFields {
  stationId: string | null;
  origin: string | null;
  carpoolRole: CarpoolRole | null;
  carId: string | null;
  lookingForCarpool: boolean;
}

const EMPTY_MODE_FIELDS: ModeFields = {
  stationId: null,
  origin: null,
  carpoolRole: null,
  carId: null,
  lookingForCarpool: false,
};

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stationsService: StationsService,
    private readonly carsService: CarsService,
    private readonly shuttlesService: ShuttlesService,
  ) {}

  /**
   * Crée ou met à jour le trajet (aller ou retour) du pax connecté.
   * Jamais bloquant : un pax peut revenir autant de fois qu'il veut, ajouter
   * le retour plus tard, changer d'avis à la dernière minute...
   */
  async upsertMine(pax: Pax, direction: Direction, dto: UpsertTripDto): Promise<Trip> {
    // Transaction : la vérification des places d'une voiture (verrou sur sa
    // ligne) et l'écriture du trajet doivent être atomiques.
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.trip.findUnique({
        where: { paxId_direction: { paxId: pax.id, direction } },
      });

      // `undefined` -> `null` explicite : "pas encore décidé" doit être écrit
      // en base, pas juste omis (sinon un update ne pourrait jamais revenir
      // à "pas décidé" après avoir été renseigné une première fois).
      const fields = {
        mode: dto.mode ?? null,
        day: toDateOrNull(dto.day) ?? null,
        time: dto.time ?? null,
        comment: dto.comment ?? null,
        ...(await this.resolveModeFields(tx, pax, direction, dto)),
      };

      if (!existing) {
        return tx.trip.create({
          data: {
            ...fields,
            direction,
            eventId: pax.eventId,
            paxId: pax.id,
            status: TripStatus.PENDING,
          },
        });
      }

      return tx.trip.update({
        where: { id: existing.id },
        data: { ...fields, status: statusAfterPaxEdit(existing.status) },
      });
    });
  }

  /**
   * Les champs spécifiques au mode : gare pour le train, voiture/point de
   * départ pour le covoiturage. Tout ce qui ne correspond pas au mode choisi
   * est remis à zéro pour ne pas garder d'infos périmées (ex: une gare
   * après être passé·e en covoit).
   */
  private async resolveModeFields(
    tx: Prisma.TransactionClient,
    pax: Pax,
    direction: Direction,
    dto: UpsertTripDto,
  ): Promise<ModeFields> {
    if (dto.mode === TransportMode.TRAIN) {
      let stationId: string | null = null;
      if (dto.stationName?.trim()) {
        stationId = (await this.stationsService.findOrCreate(pax.eventId, dto.stationName, tx)).id;
      } else if (dto.stationId) {
        stationId = (await this.stationsService.ensureInEvent(pax.eventId, dto.stationId, tx)).id;
      }
      return { ...EMPTY_MODE_FIELDS, stationId };
    }

    if (dto.mode === TransportMode.CARPOOL) {
      const origin = dto.origin?.trim() || null;
      if (dto.carpoolRole === CarpoolRole.DRIVER) {
        const car = await tx.car.findUnique({ where: { ownerPaxId: pax.id } });
        if (!car) {
          throw new BadRequestException("Déclare d'abord ta voiture pour conduire en covoit");
        }
        return {
          stationId: null,
          origin,
          carpoolRole: CarpoolRole.DRIVER,
          carId: car.id,
          lookingForCarpool: false,
        };
      }
      if (dto.carpoolRole === CarpoolRole.PASSENGER) {
        if (dto.carId) {
          await this.carsService.ensureSeatAvailable(pax, dto.carId, direction, tx);
          return {
            stationId: null,
            origin,
            carpoolRole: CarpoolRole.PASSENGER,
            carId: dto.carId,
            lookingForCarpool: false,
          };
        }
        // Pas de voiture identifiée = cherche un covoit, sauf si le pax dit explicitement le contraire.
        return {
          stationId: null,
          origin,
          carpoolRole: CarpoolRole.PASSENGER,
          carId: null,
          lookingForCarpool: dto.lookingForCarpool ?? true,
        };
      }
      return { ...EMPTY_MODE_FIELDS, origin, lookingForCarpool: dto.lookingForCarpool ?? false };
    }

    return EMPTY_MODE_FIELDS;
  }

  /**
   * Un pax se met lui/elle-même dans une navette (ou s'en retire avec
   * `null`) : seulement pour SON trajet, seulement une navette de son
   * évènement allant dans le même sens, et seulement s'il reste de la place.
   */
  async setMyShuttle(pax: Pax, direction: Direction, dto: SetMyShuttleDto): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({
      where: { paxId_direction: { paxId: pax.id, direction } },
    });
    if (!trip) throw new NotFoundException("Renseigne d'abord ce trajet");

    if (dto.shuttleId === null) {
      return this.prisma.trip.update({
        where: { id: trip.id },
        data: { shuttleId: null, status: TripStatus.PENDING },
      });
    }

    const shuttleId = dto.shuttleId;
    // Transaction + verrou sur la navette : deux paxs qui visent la dernière
    // place passent l'un après l'autre, le/la second·e la voit pleine.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shuttles WHERE id = ${shuttleId} FOR UPDATE`;
      const shuttle = await this.shuttlesService.findOneWithSeats(shuttleId, tx);
      if (!shuttle || shuttle.eventId !== pax.eventId) {
        throw new BadRequestException("Cette navette n'existe pas dans cet évènement");
      }
      if (shuttle.direction !== direction) {
        throw new BadRequestException("Cette navette ne va pas dans le bon sens");
      }
      if (trip.shuttleId !== shuttle.id && shuttle.remainingSeats <= 0) {
        throw new BadRequestException("Cette navette est pleine");
      }
      return tx.trip.update({
        where: { id: trip.id },
        data: { shuttleId: shuttle.id, status: TripStatus.ASSIGNED },
      });
    });
  }

  /** Back-office : tous les trajets d'un évènement avec le pax concerné et l'indicateur d'attente. */
  async findAllForEvent(eventId: string, status?: TripStatus, direction?: Direction) {
    const trips = await this.prisma.trip.findMany({
      where: { eventId, ...(status && { status }), ...(direction && { direction }) },
      include: { pax: true, station: true, shuttle: { select: { stationArrivalTime: true } } },
      orderBy: [...TRIPS_ORDER],
    });

    return trips.map(({ shuttle, ...trip }) => ({
      ...trip,
      waitLevel: shuttle
        ? computeWaitLevel(trip.direction, trip.time, shuttle.stationArrivalTime)
        : null,
    }));
  }

  /**
   * Vue "annuaire" des trajets de l'évènement, telle que vue par les autres
   * paxs : le nom du pax concerné (jamais ses coordonnées), le libellé de
   * la navette assignée, la gare, la voiture — jamais le commentaire du
   * trajet ou de la navette, réservés à l'organisation.
   */
  async findAllForEventOverview(eventId: string) {
    const trips = await this.prisma.trip.findMany({
      where: { eventId },
      include: {
        pax: { select: { id: true, name: true } },
        station: { select: { name: true } },
        car: { select: { name: true } },
        shuttle: { select: { id: true, label: true, stationArrivalTime: true } },
      },
      orderBy: [...TRIPS_ORDER],
    });

    return trips.map(({ pax, shuttle, station, car, ...trip }) => ({
      id: trip.id,
      paxId: pax.id,
      paxName: pax.name,
      direction: trip.direction,
      mode: trip.mode,
      day: trip.day,
      time: trip.time,
      stationId: trip.stationId,
      stationName: station?.name ?? null,
      status: trip.status,
      shuttleId: shuttle?.id ?? null,
      shuttleLabel: shuttle?.label ?? null,
      origin: trip.origin,
      carpoolRole: trip.carpoolRole,
      carId: trip.carId,
      carName: car?.name ?? null,
      lookingForCarpool: trip.lookingForCarpool,
      waitLevel: shuttle
        ? computeWaitLevel(trip.direction, trip.time, shuttle.stationArrivalTime)
        : null,
    }));
  }

  /** Assigne (ou désassigne avec `shuttleId: null`) un trajet à une navette. Réservé à l'orga. */
  async assign(id: string, dto: AssignTripDto): Promise<Trip> {
    const trip = await this.findOneOrThrow(id);
    if (dto.shuttleId) {
      const shuttle = await this.shuttlesService.findOneWithSeats(dto.shuttleId);
      if (!shuttle || shuttle.eventId !== trip.eventId) {
        throw new BadRequestException("Cette navette n'existe pas dans cet évènement");
      }
      if (shuttle.direction !== trip.direction) {
        throw new BadRequestException("Cette navette ne va pas dans le bon sens");
      }
    }
    return this.prisma.trip.update({
      where: { id },
      data: {
        shuttleId: dto.shuttleId,
        status: dto.shuttleId ? TripStatus.ASSIGNED : TripStatus.PENDING,
      },
    });
  }

  async setStatus(id: string, dto: SetTripStatusDto): Promise<Trip> {
    await this.findOneOrThrow(id);
    return this.prisma.trip.update({ where: { id }, data: { status: dto.status } });
  }

  private async findOneOrThrow(id: string): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException("Trajet introuvable");
    return trip;
  }
}
