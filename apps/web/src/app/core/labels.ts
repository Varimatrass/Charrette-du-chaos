import { Direction, TransportMode, TripStatus, WaitLevel } from "@desordre/shared-types";

/**
 * Libellés français des enums métier. Un seul endroit pour l'affichage, au
 * lieu de ternaires `=== Direction.OUTBOUND ? "Aller" : "Retour"` répétés
 * dans chaque template.
 */

export const DIRECTION_LABELS: Record<Direction, string> = {
  [Direction.OUTBOUND]: "Aller",
  [Direction.RETURN]: "Retour",
};

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  [TransportMode.TRAIN]: "Train",
  [TransportMode.CARPOOL]: "Covoiturage",
  [TransportMode.OTHER]: "Autre",
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  [TripStatus.PENDING]: "En attente",
  [TripStatus.ASSIGNED]: "Assigné",
  [TripStatus.TO_RECHECK]: "À revérifier",
};

export const WAIT_LEVEL_LABELS: Record<WaitLevel, string> = {
  [WaitLevel.OK]: "ok",
  [WaitLevel.MEDIUM]: "moyenne",
  [WaitLevel.HIGH]: "élevée",
};

export const UNKNOWN_LABEL = "?";

/** Ordre d'affichage des directions dans les formulaires (aller puis retour). */
export const DIRECTIONS: readonly Direction[] = [Direction.OUTBOUND, Direction.RETURN];
