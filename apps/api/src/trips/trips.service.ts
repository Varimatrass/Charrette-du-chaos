import { Injectable, NotFoundException } from "@nestjs/common";
import type { Pax, Trip } from "@prisma/client";
import { Direction, TripStatus } from "@desordre/shared-types";
import { toDateOrNull } from "../common/utils/dates";
import { computeWaitLevel } from "../common/utils/wait-level";
import { PrismaService } from "../prisma/prisma.service";
import { AssignTripDto } from "./dto/assign-trip.dto";
import { SetTripStatusDto } from "./dto/set-trip-status.dto";
import { UpsertTripDto } from "./dto/upsert-trip.dto";

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

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour le trajet (aller ou retour) du pax connecté.
   * Jamais bloquant : un pax peut revenir autant de fois qu'il veut, ajouter
   * le retour plus tard, changer d'avis à la dernière minute...
   */
  async upsertMine(pax: Pax, direction: Direction, dto: UpsertTripDto): Promise<Trip> {
    const existing = await this.prisma.trip.findUnique({
      where: { paxId_direction: { paxId: pax.id, direction } },
    });

    // `undefined` -> `null` explicite : "pas encore décidé" doit être écrit
    // en base, pas juste omis (sinon un update ne pourrait jamais revenir
    // à "pas décidé" après avoir été renseigné une première fois).
    const fields = {
      mode: dto.mode ?? null,
      day: toDateOrNull(dto.day) ?? null,
      time: dto.time ?? null,
      station: dto.station ?? null,
      comment: dto.comment ?? null,
    };

    if (!existing) {
      return this.prisma.trip.create({
        data: {
          ...fields,
          direction,
          eventId: pax.eventId,
          paxId: pax.id,
          status: TripStatus.PENDING,
        },
      });
    }

    return this.prisma.trip.update({
      where: { id: existing.id },
      data: { ...fields, status: statusAfterPaxEdit(existing.status) },
    });
  }

  /** Back-office : tous les trajets d'un évènement avec le pax concerné et l'indicateur d'attente. */
  async findAllForEvent(eventId: string, status?: TripStatus) {
    const trips = await this.prisma.trip.findMany({
      where: { eventId, ...(status && { status }) },
      include: { pax: true, shuttle: { select: { stationArrivalTime: true } } },
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
   * la navette assignée s'il y en a une — jamais le commentaire du trajet
   * ou de la navette, réservés à l'organisation.
   */
  async findAllForEventOverview(eventId: string) {
    const trips = await this.prisma.trip.findMany({
      where: { eventId },
      include: {
        pax: { select: { id: true, name: true } },
        shuttle: { select: { id: true, label: true, stationArrivalTime: true } },
      },
      orderBy: [...TRIPS_ORDER],
    });

    return trips.map(({ pax, shuttle, ...trip }) => ({
      id: trip.id,
      paxId: pax.id,
      paxName: pax.name,
      direction: trip.direction,
      mode: trip.mode,
      day: trip.day,
      time: trip.time,
      station: trip.station,
      status: trip.status,
      shuttleId: shuttle?.id ?? null,
      shuttleLabel: shuttle?.label ?? null,
      waitLevel: shuttle
        ? computeWaitLevel(trip.direction, trip.time, shuttle.stationArrivalTime)
        : null,
    }));
  }

  /** Assigne (ou désassigne avec `shuttleId: null`) un trajet à une navette. */
  async assign(id: string, dto: AssignTripDto): Promise<Trip> {
    await this.findOneOrThrow(id);
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
