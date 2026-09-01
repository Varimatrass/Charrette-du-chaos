import { ModeTransport, NiveauAttente, Sens, StatutTrajet } from "./enums";

/**
 * Toutes les dates/heures transitent en JSON sous forme de chaînes ISO 8601.
 * `jour` est une date (YYYY-MM-DD), `heure` une heure locale (HH:mm).
 */
export type IsoDate = string;
export type IsoTime = string;

export interface Edition {
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
  editionId: string;
  nom: string;
  contactEmail: string | null;
  contactTelephone: string | null;
  commentaire: string | null;
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
  editionId: string;
  paxId: string;
  sens: Sens;
  mode: ModeTransport;
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
  editionId: string;
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

/** Une navette avec la liste de ses passager·es et ses places restantes calculées. */
export interface NavetteAvecPassagers extends Navette {
  passagers: TrajetAvecPax[];
  placesRestantes: number;
}
