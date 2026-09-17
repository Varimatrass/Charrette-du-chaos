import { Direction } from "@desordre/shared-types";
import type { CarOverview, Shuttle, TransportMode } from "@desordre/shared-types";

/** Qui regarde un tableau : l'orga voit et modifie tout, un pax voit l'essentiel et n'agit que sur ses trajets. */
export type TableRole = "admin" | "pax";

/** Contexte commun aux tableaux : le rôle, et selon le rôle l'évènement (admin) ou le jeton (pax). */
export interface TableContext {
  role: TableRole;
  eventId?: string;
  token?: string;
  /** Côté pax : l'id du pax connecté, pour repérer ses propres lignes. */
  myPaxId?: string;
}

export const DIRECTIONS: readonly Direction[] = [Direction.OUTBOUND, Direction.RETURN];

/** Le minimum d'un trajet pour en faire un résumé lisible dans les tableaux. */
export interface TripSummaryInput {
  mode: TransportMode | null;
  shuttleId: string | null;
  carpoolRole: "DRIVER" | "PASSENGER" | null;
  carId: string | null;
  lookingForCarpool: boolean;
}

/**
 * Résumé en une ligne de "comment iel vient" : mode + ce qu'iel a ou cherche.
 * Utilisé par le tableau des paxs (admin et pax).
 */
export function summarizeTrip(
  trip: TripSummaryInput | undefined,
  shuttlesById: Map<string, Pick<Shuttle, "label">>,
  carsById: Map<string, CarOverview>,
): string {
  if (!trip) return "—";
  switch (trip.mode) {
    case "TRAIN": {
      const shuttle = trip.shuttleId ? shuttlesById.get(trip.shuttleId) : undefined;
      return shuttle ? `Train · navette ${shuttle.label}` : "Train · cherche une navette";
    }
    case "CARPOOL": {
      const car = trip.carId ? carsById.get(trip.carId) : undefined;
      if (trip.carpoolRole === "DRIVER") return `Covoit · conduit${car ? ` (${car.name})` : ""}`;
      if (car) return `Covoit · passager·e de ${car.owner.name} (${car.name})`;
      return trip.lookingForCarpool ? "Covoit · cherche un covoit" : "Covoit · passager·e";
    }
    case "OTHER":
      return "Autre";
    default:
      return "Pas encore décidé";
  }
}
