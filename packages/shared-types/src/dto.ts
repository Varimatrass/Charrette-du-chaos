import { Direction, TransportMode, TripStatus, VehicleLendingMode } from "./enums";

// ---- Évènement ----

export interface CreateEventInput {
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  referenceStation: string;
}

export type UpdateEventInput = Partial<CreateEventInput>;

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
  vehicleLendingMode?: VehicleLendingMode;
  hasDrivingLicense?: boolean;
  willingToDriveShuttle?: boolean;
}

export type UpdatePaxInput = Partial<Omit<CreatePaxInput, "eventId">>;

/** Renvoyé une seule fois, juste après la création du pax. */
export interface PaxSubmissionResult {
  pax: { id: string; name: string };
  accessToken: string;
  /** Lien complet à afficher/copier côté frontend, ex: /mon-espace/<token> */
  personalLink: string;
}

// ---- Trajet ----

/**
 * Corps de PUT /pax/me/trips/:direction — la direction vient de l'URL, pas
 * du body. Tous les champs sont facultatifs : "pas encore décidé" est un
 * état valide à l'inscription, à compléter plus tard.
 */
export interface UpsertTripInput {
  mode?: TransportMode;
  day?: string;
  time?: string;
  station?: string;
  comment?: string;
}

/** Action réservée au back-office organisateur·ice. */
export interface AssignTripInput {
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
  driverName?: string;
  vehicle?: string;
  departureTime: string;
  stationArrivalTime: string;
  venueReturnTime?: string;
  capacity: number;
  comment?: string;
  driverPaxId?: string;
}

export type UpdateShuttleInput = Partial<Omit<CreateShuttleInput, "eventId">>;

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
