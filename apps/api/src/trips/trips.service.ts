import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Pax, Prisma, Trip } from "@prisma/client";
import {
  CarpoolRole,
  Direction,
  TransportMode,
  TripStatus,
  VehicleLendingMode,
} from "@desordre/shared-types";
import { frenchDay, isoDay, toDate, toDateOrNull } from "../common/utils/dates.js";
import { computeWaitLevel } from "../common/utils/wait-level.js";
import { CarsService } from "../cars/cars.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ShuttlesService } from "../shuttles/shuttles.service.js";
import { StationsService } from "../stations/stations.service.js";
import { AssignTripDto } from "./dto/assign-trip.dto.js";
import { SetMyShuttleDto } from "./dto/set-my-shuttle.dto.js";
import { SetTripStatusDto } from "./dto/set-trip-status.dto.js";
import { UpsertTripDto } from "./dto/upsert-trip.dto.js";

/** Places passager·es d'une voiture créée par un·e passager·e qui ne les connaît pas. */
const DEFAULT_NEW_CAR_SEATS = 3;

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

/**
 * Statut d'un trajet qui n'est dans aucune navette : en attente d'une navette
 * s'il est en train, sinon il n'en a pas besoin (covoit, autre, indécis).
 */
export function statusWithoutShuttle(mode: TransportMode | null): TripStatus {
  return mode === TransportMode.TRAIN ? TripStatus.PENDING : TripStatus.NO_SHUTTLE;
}

/** Les navettes sont réservées aux trajets en train. */
export const SHUTTLE_TRAIN_ONLY_MESSAGE =
  "Les navettes sont réservées aux paxs qui viennent en train";

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

      await this.ensureDayMakesSense(tx, pax, direction, dto.day);

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
            status: statusWithoutShuttle(fields.mode),
          },
        });
      }

      // Quitter le train fait sortir de la navette : la place se libère et le
      // trajet n'a plus besoin de navette. En train, une assignation existante
      // est gardée mais marquée "à revérifier".
      const keepsShuttle = fields.mode === TransportMode.TRAIN && existing.shuttleId !== null;
      return tx.trip.update({
        where: { id: existing.id },
        data: {
          ...fields,
          shuttleId: keepsShuttle ? existing.shuttleId : null,
          shuttleAssignedAt: keepsShuttle ? existing.shuttleAssignedAt : null,
          status: keepsShuttle
            ? statusAfterPaxEdit(existing.status)
            : statusWithoutShuttle(fields.mode),
        },
      });
    });
  }

  /**
   * Un trajet aller ne peut pas arriver après la fin de l'évènement, un retour
   * ne peut pas partir avant son début, et on ne repart pas avant d'être
   * arrivé·e. Arriver en avance ou repartir plus tard reste possible.
   */
  private async ensureDayMakesSense(
    tx: Prisma.TransactionClient,
    pax: Pax,
    direction: Direction,
    rawDay: string | undefined,
  ): Promise<void> {
    if (!rawDay) return;
    const day = toDate(rawDay);
    const event = await tx.event.findUniqueOrThrow({
      where: { id: pax.eventId },
      select: { startDate: true, endDate: true },
    });
    if (direction === Direction.OUTBOUND && isoDay(day) > isoDay(event.endDate)) {
      throw new BadRequestException(
        `L'évènement se termine le ${frenchDay(event.endDate)} : ton arrivée ne peut pas être après.`,
      );
    }
    if (direction === Direction.RETURN && isoDay(day) < isoDay(event.startDate)) {
      throw new BadRequestException(
        `L'évènement commence le ${frenchDay(event.startDate)} : ton départ ne peut pas être avant.`,
      );
    }
    const other = await tx.trip.findUnique({
      where: {
        paxId_direction: {
          paxId: pax.id,
          direction: direction === Direction.OUTBOUND ? Direction.RETURN : Direction.OUTBOUND,
        },
      },
      select: { day: true },
    });
    if (!other?.day) return;
    const [outbound, back] = direction === Direction.OUTBOUND ? [day, other.day] : [other.day, day];
    if (isoDay(back) < isoDay(outbound)) {
      throw new BadRequestException(
        `Ton retour (${frenchDay(back)}) ne peut pas être avant ton arrivée (${frenchDay(outbound)}).`,
      );
    }
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
        // Voiture pas encore dans la liste (conducteur·ice pas inscrit·e) :
        // on la crée sans propriétaire, quelqu'un pourra la revendiquer.
        const carId = dto.newCarName?.trim()
          ? (
              await this.carsService.findOrCreateOwnerless(
                pax.eventId,
                dto.newCarName,
                dto.newCarSeats ?? DEFAULT_NEW_CAR_SEATS,
                VehicleLendingMode.NOT_AVAILABLE,
                tx,
              )
            ).id
          : dto.carId;
        if (carId) {
          await this.carsService.ensureSeatAvailable(pax, carId, direction, tx);
          return {
            stationId: null,
            origin,
            carpoolRole: CarpoolRole.PASSENGER,
            carId,
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
   * `null`) : seulement pour SON trajet en train, seulement une navette de
   * son évènement allant dans le même sens, le même jour que son trajet (si
   * iel l'a renseigné), et seulement s'il reste de la place.
   */
  async setMyShuttle(pax: Pax, direction: Direction, dto: SetMyShuttleDto): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({
      where: { paxId_direction: { paxId: pax.id, direction } },
    });
    if (!trip) throw new NotFoundException("Renseigne d'abord ce trajet");

    if (dto.shuttleId === null) {
      return this.prisma.trip.update({
        where: { id: trip.id },
        data: {
          shuttleId: null,
          shuttleAssignedAt: null,
          status: statusWithoutShuttle(trip.mode),
        },
      });
    }
    if (trip.mode !== TransportMode.TRAIN) {
      throw new BadRequestException(SHUTTLE_TRAIN_ONLY_MESSAGE);
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
      if (trip.day && isoDay(trip.day) !== isoDay(shuttle.day)) {
        throw new BadRequestException(
          `Cette navette roule le ${frenchDay(shuttle.day)}, or ton trajet est prévu le ${frenchDay(trip.day)}. Change le jour de ton trajet ou choisis une navette de ce jour-là.`,
        );
      }
      if (trip.shuttleId !== shuttle.id && shuttle.remainingSeats <= 0) {
        throw new BadRequestException("Cette navette est pleine");
      }
      if (trip.shuttleId === shuttle.id) return trip;
      return tx.trip.update({
        where: { id: trip.id },
        data: { shuttleId: shuttle.id, shuttleAssignedAt: new Date(), status: TripStatus.ASSIGNED },
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

  /**
   * Assigne (ou désassigne avec `shuttleId: null`) un trajet en train à une
   * navette. Réservé à l'orga, qui peut surbooker une navette (pas de contrôle
   * de places : l'affichage le signale) ou placer quelqu'un un autre jour.
   */
  async assign(id: string, dto: AssignTripDto): Promise<Trip> {
    const trip = await this.findOneOrThrow(id);
    if (dto.shuttleId && trip.mode !== TransportMode.TRAIN) {
      throw new BadRequestException(SHUTTLE_TRAIN_ONLY_MESSAGE);
    }
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
        shuttleAssignedAt: dto.shuttleId ? new Date() : null,
        status: dto.shuttleId ? TripStatus.ASSIGNED : statusWithoutShuttle(trip.mode),
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
