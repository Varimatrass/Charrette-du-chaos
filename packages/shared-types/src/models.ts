import {
  CarpoolRole,
  Direction,
  TransportMode,
  TripStatus,
  VehicleLendingMode,
  WaitLevel,
} from "./enums";

/**
 * Toutes les dates/heures transitent en JSON sous forme de chaînes ISO 8601.
 * `day` est une date (YYYY-MM-DD), `time` une heure locale (HH:mm).
 */
export type IsoDate = string;
export type IsoTime = string;

export interface Event {
  id: string;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  location: string;
  /** Tant que c'est `false`, l'évènement n'est pas listé sur la page d'accueil publique. */
  openToPaxs: boolean;
  /** Gare de référence pour les navettes, parmi les gares de l'évènement. */
  preferredStationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Un évènement avec ses gares (vue de configuration et vue publique). */
export interface EventWithStations extends Event {
  stations: Station[];
}

/** Gare connue pour un évènement (créée par l'orga ou à la volée par un pax). */
export interface Station {
  id: string;
  eventId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Voiture d'un pax venant en covoiturage : au plus une par pax et par évènement. */
export interface Car {
  id: string;
  eventId: string;
  ownerPaxId: string;
  name: string;
  /** Places disponibles pour des passager·es (hors conducteur·ice). */
  seats: number;
  lendingMode: VehicleLendingMode;
  createdAt: string;
  updatedAt: string;
}

/**
 * Voiture telle que proposée aux autres paxs pour s'y déclarer passager·e :
 * le nom du/de la propriétaire et les places encore libres par sens.
 */
export interface CarOverview {
  id: string;
  name: string;
  seats: number;
  lendingMode: VehicleLendingMode;
  owner: { id: string; name: string };
  /** Passager·es déjà déclaré·es, par direction. */
  passengers: Record<Direction, PassengerName[]>;
  remainingSeats: Record<Direction, number>;
}

/**
 * Vue "publique" d'un pax, telle que renvoyée après authentification par
 * jeton personnel. Ne contient jamais le jeton lui-même.
 */
export interface Pax {
  id: string;
  eventId: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  discordHandle: string | null;
  comment: string | null;
  // Bloc véhicule/conduite : `null` veut dire "pas encore répondu", à
  // distinguer de `false` ("non"). Les détails de la voiture sont sur `Car`.
  hasVehicle: boolean | null;
  hasDrivingLicense: boolean | null;
  willingToDriveShuttle: boolean | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Vue d'un pax pour le back-office organisateur·ice : inclut les infos
 * nécessaires pour retrouver/regénérer son lien personnel.
 */
export interface PaxAdmin extends Pax {
  accessToken: string;
}

export interface Trip {
  id: string;
  eventId: string;
  paxId: string;
  direction: Direction;
  // `null` = mode de transport pas encore décidé à l'inscription (le pax
  // pourra revenir le préciser plus tard, comme le reste du trajet).
  mode: TransportMode | null;
  day: IsoDate | null;
  time: IsoTime | null;
  /** Train : gare d'arrivée (aller) / de départ (retour). */
  stationId: string | null;
  shuttleId: string | null;
  status: TripStatus;
  /** Covoiturage : d'où le pax part (aller) / où iel rentre (retour). */
  origin: string | null;
  carpoolRole: CarpoolRole | null;
  /** Sa voiture si DRIVER, celle où iel a une place si PASSENGER. */
  carId: string | null;
  lookingForCarpool: boolean;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Shuttle {
  id: string;
  eventId: string;
  label: string;
  day: IsoDate;
  direction: Direction;
  vehicle: string | null;
  departureTime: IsoTime;
  stationArrivalTime: IsoTime;
  venueReturnTime: IsoTime | null;
  capacity: number;
  comment: string | null;
  /** Le/la conducteur·ice est toujours un pax de l'évènement ; `null` = pas encore attribué·e. */
  driverPaxId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Un trajet avec le pax qu'il concerne, pour l'affichage admin. */
export interface TripWithPax extends Trip {
  pax: Pax;
  station: Station | null;
  waitLevel: WaitLevel | null;
}

/** Une navette avec ses places restantes calculées et le nom de son/sa conducteur·ice. */
export interface ShuttleWithRemainingSeats extends Shuttle {
  remainingSeats: number;
  driverPax: { id: string; name: string } | null;
}

/**
 * Un co-passager·e tel que vu par les autres paxs de la même navette ou de
 * la même voiture : juste son nom. Contrairement à `Pax`, ne contient jamais
 * l'email ni le téléphone — dans un évènement en autogestion, les paxs d'une
 * même navette savent qui la conduit et avec qui iels la partagent, mais
 * leurs coordonnées de contact restent privées entre elleux.
 */
export interface PassengerName {
  paxId: string;
  name: string;
}

/**
 * Vue d'une navette pour les paxs : conducteur·ice/véhicule, places
 * restantes, et noms des co-passager·es — jamais leurs coordonnées de contact.
 *
 * Exception ciblée : `driverContactPhone` porte le téléphone du pax
 * conducteur·ice — mais UNIQUEMENT quand le pax qui consulte cette navette
 * en fait lui/elle-même partie (voir `ShuttlesService.findAllForEventAsPax`).
 */
export interface ShuttleWithPassengerNames extends ShuttleWithRemainingSeats {
  passengers: PassengerName[];
  driverContactPhone: string | null;
}

/** Une navette avec la liste complète de ses passager·es, coordonnées incluses (back-office uniquement). */
export interface ShuttleWithPassengers extends ShuttleWithRemainingSeats {
  passengers: TripWithPax[];
}

/**
 * Créneau où un·e pax ayant accepté de conduire des navettes se déclare
 * disponible. Sert de base aux admins pour créer les navettes avec un·e
 * conducteur·ice déjà partant·e.
 */
export interface DriverAvailabilitySlot {
  id: string;
  eventId: string;
  paxId: string;
  day: IsoDate;
  startTime: IsoTime | null;
  endTime: IsoTime | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Vue back-office d'un créneau de disponibilité, avec de quoi identifier et contacter le pax. */
export interface DriverAvailabilitySlotWithPax extends DriverAvailabilitySlot {
  pax: {
    id: string;
    name: string;
    contactPhone: string | null;
  };
}

/** Résumé d'un trajet dans l'annuaire des paxs : de quoi voir comment chacun·e vient. */
export interface PaxOverviewTrip {
  direction: Direction;
  mode: TransportMode | null;
  status: TripStatus;
  shuttleId: string | null;
  carpoolRole: CarpoolRole | null;
  carId: string | null;
  lookingForCarpool: boolean;
}

/**
 * Vue "annuaire" d'un pax pour les autres paxs de son évènement : jamais
 * ses coordonnées de contact (email/téléphone) ni son jeton d'accès —
 * seulement son nom, comment iel vient et ce qu'iel cherche.
 */
export interface PaxOverview {
  id: string;
  name: string;
  trips: PaxOverviewTrip[];
}

/**
 * Vue "annuaire" d'un trajet pour les autres paxs de son évènement : le nom
 * du pax concerné (jamais ses coordonnées), le libellé de la navette
 * assignée s'il y en a une — jamais le commentaire du trajet ou de la
 * navette, réservés à l'organisation.
 */
export interface TripOverview {
  id: string;
  paxId: string;
  paxName: string;
  direction: Direction;
  mode: TransportMode | null;
  day: IsoDate | null;
  time: IsoTime | null;
  stationId: string | null;
  stationName: string | null;
  status: TripStatus;
  shuttleId: string | null;
  shuttleLabel: string | null;
  origin: string | null;
  carpoolRole: CarpoolRole | null;
  carId: string | null;
  carName: string | null;
  lookingForCarpool: boolean;
  waitLevel: WaitLevel | null;
}

/**
 * Vue "mon espace" renvoyée par GET /pax/me : le pax, sa voiture éventuelle,
 * et ses trajets avec la navette / la gare / la voiture liées à chacun.
 */
export interface PaxWithTrips extends Pax {
  car: Car | null;
  trips: (Trip & { shuttle: Shuttle | null; station: Station | null; car: Car | null })[];
}
