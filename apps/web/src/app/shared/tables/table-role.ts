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
  /** Côté pax : l'évènement du pax connecté (pour connaître la gare desservie). */
  myEventId?: string;
}

/** L'évènement affiché, quel que soit le rôle. */
export function contextEventId(context: TableContext): string | undefined {
  return context.role === "admin" ? context.eventId : context.myEventId;
}

export const DIRECTIONS: readonly Direction[] = [Direction.OUTBOUND, Direction.RETURN];

/** Le minimum d'un trajet pour en faire un résumé lisible dans les tableaux. */
export interface TripSummaryInput {
  mode: TransportMode | null;
  stationId: string | null;
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
  preferredStationId: string | null = null,
): string {
  if (!trip) return "—";
  switch (trip.mode) {
    case "TRAIN": {
      const shuttle = trip.shuttleId ? shuttlesById.get(trip.shuttleId) : undefined;
      if (shuttle) return `Train · navette ${shuttle.label}`;
      // Une gare que les navettes ne desservent pas : petit clin d'œil (B12).
      if (trip.stationId && preferredStationId && trip.stationId !== preferredStationId) {
        return `Train · ${offTheMapJoke(trip.stationId)}`;
      }
      return "Train · cherche une navette";
    }
    case "CARPOOL": {
      const car = trip.carId ? carsById.get(trip.carId) : undefined;
      if (trip.carpoolRole === "DRIVER") return `Covoit · conduit${car ? ` (${car.name})` : ""}`;
      if (car) {
        return car.owner
          ? `Covoit · passager·e de ${car.owner.name} (${car.name})`
          : `Covoit · passager·e (${car.name})`;
      }
      if (trip.lookingForCarpool) return "Covoit · cherche un covoit";
      return trip.carpoolRole === "PASSENGER" ? "Covoit · passager·e" : "Covoit";
    }
    case "OTHER":
      return "Autre";
    default:
      return "Pas encore décidé";
  }
}

/**
 * Easter egg : pour un trajet en train vers une gare que la charrette ne
 * dessert pas. La blague dépend de la gare (toujours la même pour une gare
 * donnée, mais pas la même pour toutes).
 */
export const OFF_THE_MAP_JOKES: readonly string[] = [
  "gare exotique, la charrette n'y met pas les roues 🐴",
  "gare hors zone, prévois les mollets 🦵",
  "a choisi une gare secrète, respect 🫡",
  "gare non desservie, la charrette boude 😤",
  "gare inconnue des cartes, bonne chance 🗺️",
];

export function offTheMapJoke(stationId: string): string {
  let hash = 0;
  for (const char of stationId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return OFF_THE_MAP_JOKES[hash % OFF_THE_MAP_JOKES.length]!;
}
