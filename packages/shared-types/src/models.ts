import { Direction, TransportMode, TripStatus, VehicleLendingMode, WaitLevel } from "./enums";

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
  referenceStation: string;
  createdAt: string;
  updatedAt: string;
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
  // distinguer de `false` ("non"). `vehicleLendingMode` n'a de sens que
  // si `hasVehicle` est `true`.
  hasVehicle: boolean | null;
  vehicleLendingMode: VehicleLendingMode | null;
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
  station: string | null;
  shuttleId: string | null;
  status: TripStatus;
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
  driverName: string | null;
  vehicle: string | null;
  departureTime: IsoTime;
  stationArrivalTime: IsoTime;
  venueReturnTime: IsoTime | null;
  capacity: number;
  comment: string | null;
  // Pax identifié comme le/la conducteur·ice réel·le de cette navette,
  // `null` si non renseigné ou si le/la conducteur·ice n'est pas un pax de
  // l'évènement. Permet d'aller chercher son contactPhone pour l'exposer
  // aux co-passager·es (voir ShuttleWithPassengerNames).
  driverPaxId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Un trajet avec le pax qu'il concerne, pour l'affichage admin. */
export interface TripWithPax extends Trip {
  pax: Pax;
  waitLevel: WaitLevel | null;
}

/** Une navette avec ses places restantes calculées. */
export interface ShuttleWithRemainingSeats extends Shuttle {
  remainingSeats: number;
}

/**
 * Un co-passager·e tel que vu par les autres paxs de la même navette : juste
 * son nom. Contrairement à `Pax`, ne contient jamais l'email ni le
 * téléphone — dans un évènement en autogestion, les paxs d'une même navette
 * savent qui la conduit et avec qui iels la partagent (c'est même utile,
 * pour se retrouver), mais leurs coordonnées de contact restent privées
 * entre elleux.
 */
export interface PassengerName {
  paxId: string;
  name: string;
}

/**
 * Vue d'une navette pour les paxs : conducteur·ice/véhicule (déjà sur
 * `Shuttle`), places restantes, et noms des co-passager·es — jamais leurs
 * coordonnées de contact.
 *
 * Exception ciblée : `driverContactPhone` porte le téléphone du pax
 * identifié comme conducteur·ice — mais UNIQUEMENT quand le pax qui
 * consulte cette navette en fait lui/elle-même partie (voir le calcul côté
 * `ShuttlesService.findAllForEventAsPax`). `null` pour tout le monde
 * d'autre, ou si aucun pax n'est identifié comme conducteur·ice.
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

/**
 * Vue back-office d'un créneau de disponibilité, avec de quoi identifier et
 * contacter le pax directement depuis l'écran de création d'une navette
 * (l'admin a de toute façon accès à ces infos ailleurs, pas une nouvelle
 * fuite de confidentialité).
 */
export interface DriverAvailabilitySlotWithPax extends DriverAvailabilitySlot {
  pax: {
    id: string;
    name: string;
    contactPhone: string | null;
  };
}

/**
 * Vue "annuaire" d'un pax pour les autres paxs de son évènement : jamais
 * ses coordonnées de contact (email/téléphone) ni son jeton d'accès —
 * seulement de quoi se coordonner (nom, discord, véhicule/permis/conduite,
 * commentaire).
 */
export interface PaxOverview {
  id: string;
  name: string;
  discordHandle: string | null;
  comment: string | null;
  hasVehicle: boolean | null;
  vehicleLendingMode: VehicleLendingMode | null;
  hasDrivingLicense: boolean | null;
  willingToDriveShuttle: boolean | null;
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
  station: string | null;
  status: TripStatus;
  shuttleId: string | null;
  shuttleLabel: string | null;
  waitLevel: WaitLevel | null;
}

/**
 * Vue "mon espace" renvoyée par GET /pax/me : le pax + ses trajets, avec la
 * navette éventuellement assignée à chacun.
 */
export interface PaxWithTrips extends Pax {
  trips: (Trip & { shuttle: Shuttle | null })[];
}
