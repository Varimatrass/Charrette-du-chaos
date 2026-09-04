import { ModeTransport, NiveauAttente, Sens, StatutTrajet, VehicleLendingMode } from "./enums";

/**
 * Toutes les dates/heures transitent en JSON sous forme de chaînes ISO 8601.
 * `jour` est une date (YYYY-MM-DD), `heure` une heure locale (HH:mm).
 */
export type IsoDate = string;
export type IsoTime = string;

export interface Event {
  id: string;
  nom: string;
  dateDebut: IsoDate;
  dateFin: IsoDate;
  lieu: string;
  gareReference: string;
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
  nom: string;
  contactEmail: string | null;
  contactTelephone: string | null;
  discordHandle: string | null;
  commentaire: string | null;
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

export interface Trajet {
  id: string;
  eventId: string;
  paxId: string;
  sens: Sens;
  // `null` = mode de transport pas encore décidé à l'inscription (le pax
  // pourra revenir le préciser plus tard, comme le reste du trajet).
  mode: ModeTransport | null;
  jour: IsoDate | null;
  heure: IsoTime | null;
  gare: string | null;
  navetteId: string | null;
  statut: StatutTrajet;
  commentaire: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Navette {
  id: string;
  eventId: string;
  libelle: string;
  jour: IsoDate;
  sens: Sens;
  conducteur: string | null;
  vehicule: string | null;
  heureDepart: IsoTime;
  heureArriveeGare: IsoTime;
  heureRetourLieu: IsoTime | null;
  capacite: number;
  commentaire: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Un trajet avec le pax qu'il concerne, pour l'affichage admin. */
export interface TrajetAvecPax extends Trajet {
  pax: Pax;
  niveauAttente: NiveauAttente | null;
}

/** Une navette avec ses places restantes calculées. */
export interface NavetteAvecPlacesRestantes extends Navette {
  placesRestantes: number;
}

/**
 * Un co-passager·e tel que vu par les autres paxs de la même navette : juste
 * son nom. Contrairement à `Pax`, ne contient jamais l'email ni le
 * téléphone — dans un évènement en autogestion, les paxs d'une même navette
 * savent qui la conduit et avec qui iels la partagent (c'est même utile,
 * pour se retrouver), mais leurs coordonnées de contact restent privées
 * entre elleux.
 */
export interface PassagerNom {
  paxId: string;
  nom: string;
}

/**
 * Vue d'une navette pour les paxs : conducteur·ice/véhicule (déjà sur
 * `Navette`), places restantes, et noms des co-passager·es — jamais leurs
 * coordonnées de contact.
 */
export interface NavetteAvecNomsPassagers extends NavetteAvecPlacesRestantes {
  passagers: PassagerNom[];
}

/** Une navette avec la liste complète de ses passager·es, coordonnées incluses (back-office uniquement). */
export interface NavetteAvecPassagers extends NavetteAvecPlacesRestantes {
  passagers: TrajetAvecPax[];
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
