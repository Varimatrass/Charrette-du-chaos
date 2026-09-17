import { CarpoolRole, Direction, TransportMode, TripStatus, VehicleLendingMode } from "./enums";

/** Tous les champs facultatifs, et effaçables avec `null`. */
export type Nullable<T> = { [K in keyof T]?: T[K] | null };

// ---- Évènement ----

export interface CreateEventInput {
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  /** Gares à créer avec l'évènement ; la première devient la gare préférée. */
  stations?: string[];
}

export interface UpdateEventInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  openToPaxs?: boolean;
  /** `null` pour ne plus avoir de gare préférée. */
  preferredStationId?: string | null;
}

// ---- Gares ----

export interface CreateStationInput {
  name: string;
}

// ---- Pax (auto-inscription, sans compte) ----

/**
 * Première saisie d'un pax : crée le pax et lui renvoie son jeton d'accès
 * personnel (voir PaxSubmissionResult).
 */
export interface CreatePaxInput {
  eventId: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  discordHandle?: string;
  comment?: string;
  hasVehicle?: boolean;
  hasDrivingLicense?: boolean;
  willingToDriveShuttle?: boolean;
}

/**
 * Mise à jour partielle : un champ absent n'est pas touché, un champ à `null`
 * est effacé (ex: retirer son email). Le nom, lui, ne peut pas être effacé.
 */
export type UpdatePaxInput = { name?: string } & Nullable<Omit<CreatePaxInput, "eventId" | "name">>;

/** Renvoyé une seule fois, juste après la création du pax. */
export interface PaxSubmissionResult {
  pax: { id: string; name: string };
  accessToken: string;
  /** Lien complet à afficher/copier côté frontend, ex: /mon-espace/<token> */
  personalLink: string;
}

// ---- Voiture ----

/** Création ou mise à jour de SA voiture (une seule par pax). */
export interface UpsertCarInput {
  name: string;
  seats: number;
  lendingMode: VehicleLendingMode;
}

// ---- Trajet ----

/**
 * Corps de PUT /pax/me/trips/:direction — la direction vient de l'URL, pas
 * du body. Tous les champs sont facultatifs : "pas encore décidé" est un
 * état valide à l'inscription, à compléter plus tard.
 *
 * Train : `stationId` (gare existante) OU `stationName` (nouvelle gare,
 * créée à la volée pour l'évènement). Covoiturage : `origin`, `carpoolRole`,
 * puis `carId` (voiture où iel a une place, si PASSENGER) ou
 * `lookingForCarpool` (cherche encore).
 */
export interface UpsertTripInput {
  mode?: TransportMode;
  day?: string;
  time?: string;
  stationId?: string;
  stationName?: string;
  comment?: string;
  origin?: string;
  carpoolRole?: CarpoolRole;
  carId?: string;
  lookingForCarpool?: boolean;
}

/** Action réservée au back-office organisateur·ice. */
export interface AssignTripInput {
  shuttleId: string | null;
}

/** Un pax se met (ou se retire) lui/elle-même dans une navette non pleine. */
export interface SetMyShuttleInput {
  shuttleId: string | null;
}

export interface SetTripStatusInput {
  status: TripStatus;
}

// ---- Navette ----

export interface CreateShuttleInput {
  eventId: string;
  label: string;
  day: string;
  direction: Direction;
  vehicle?: string;
  departureTime: string;
  stationArrivalTime: string;
  venueReturnTime?: string;
  capacity: number;
  comment?: string;
  driverPaxId?: string;
}

/** Les champs obligatoires d'une navette peuvent être omis mais jamais mis à `null`. */
export type UpdateShuttleInput = Partial<
  Pick<
    CreateShuttleInput,
    "label" | "day" | "direction" | "departureTime" | "stationArrivalTime" | "capacity"
  >
> &
  Nullable<Pick<CreateShuttleInput, "vehicle" | "venueReturnTime" | "comment" | "driverPaxId">>;

// ---- Recherche / lookup admin ----

export interface SearchPaxQuery {
  eventId: string;
  name: string;
}

// ---- Créneaux de disponibilité conducteur·ice ----

export interface CreateDriverAvailabilitySlotInput {
  day: string;
  startTime?: string;
  endTime?: string;
  comment?: string;
}

export type UpdateDriverAvailabilitySlotInput = Partial<CreateDriverAvailabilitySlotInput>;
