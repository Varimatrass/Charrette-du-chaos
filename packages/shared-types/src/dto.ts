import { ModeTransport, Sens, StatutTrajet, VehicleLendingMode } from "./enums";

// ---- Évènement ----

export interface CreateEventInput {
  nom: string;
  dateDebut: string;
  dateFin: string;
  lieu: string;
  gareReference: string;
}

export type UpdateEventInput = Partial<CreateEventInput>;

// ---- Pax (auto-inscription, sans compte) ----

/**
 * Première saisie d'un pax : crée le pax et lui renvoie son jeton d'accès
 * personnel (voir PaxSubmissionResult).
 */
export interface CreatePaxInput {
  eventId: string;
  nom: string;
  contactEmail?: string;
  contactTelephone?: string;
  discordHandle?: string;
  commentaire?: string;
  hasVehicle?: boolean;
  vehicleLendingMode?: VehicleLendingMode;
  hasDrivingLicense?: boolean;
  willingToDriveShuttle?: boolean;
}

export type UpdatePaxInput = Partial<Omit<CreatePaxInput, "eventId">>;

/** Renvoyé une seule fois, juste après la création du pax. */
export interface PaxSubmissionResult {
  pax: { id: string; nom: string };
  accessToken: string;
  /** Lien complet à afficher/copier côté frontend, ex: /mon-espace/<token> */
  lienPersonnel: string;
}

// ---- Trajet ----

export interface CreateTrajetInput {
  sens: Sens;
  // Facultatif : le mode de transport peut être "pas encore décidé" à
  // l'inscription et précisé plus tard.
  mode?: ModeTransport;
  jour?: string;
  heure?: string;
  gare?: string;
  commentaire?: string;
}

export type UpdateTrajetInput = Partial<CreateTrajetInput>;

/** Action réservée au back-office organisateur·ice. */
export interface AssignerTrajetInput {
  navetteId: string | null;
}

export interface SetStatutTrajetInput {
  statut: StatutTrajet;
}

// ---- Navette ----

export interface CreateNavetteInput {
  eventId: string;
  libelle: string;
  jour: string;
  sens: Sens;
  conducteur?: string;
  vehicule?: string;
  heureDepart: string;
  heureArriveeGare: string;
  heureRetourLieu?: string;
  capacite: number;
  commentaire?: string;
}

export type UpdateNavetteInput = Partial<Omit<CreateNavetteInput, "eventId">>;

// ---- Recherche / lookup admin ----

export interface RechercherPaxQuery {
  eventId: string;
  nom: string;
}


// ---- Créneaux de disponibilité conducteur·ice ----

export interface CreateDriverAvailabilitySlotInput {
  day: string;
  startTime?: string;
  endTime?: string;
  comment?: string;
}

export type UpdateDriverAvailabilitySlotInput = Partial<CreateDriverAvailabilitySlotInput>;
