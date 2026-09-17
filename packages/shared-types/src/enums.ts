/**
 * Les enums partagés sont déclarés comme des objets `as const` + un type
 * union, plutôt qu'avec le mot-clé `enum` de TypeScript. Deux raisons :
 * - ils deviennent structurellement compatibles avec les enums que Prisma
 *   génère côté API (mêmes valeurs littérales), donc plus aucun cast
 *   `as unknown as` entre les deux mondes ;
 * - un `as const` s'utilise exactement comme un enum (`Direction.OUTBOUND`)
 *   tout en restant un simple objet JS, ce qui simplifie l'itération et
 *   la validation (`Object.values(...)`).
 */

/**
 * Sens d'un trajet ou d'une navette : à l'aller (vers le lieu de l'évènement)
 * ou au retour (vers la gare / le domicile).
 */
export const Direction = {
  OUTBOUND: "OUTBOUND",
  RETURN: "RETURN",
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

/**
 * Moyen de transport utilisé par un pax pour un trajet donné.
 * V1 ne traite en détail que TRAIN (navettes) ; CARPOOL est capté dès
 * maintenant pour ne pas avoir à resaisir l'info à l'itération suivante.
 */
export const TransportMode = {
  TRAIN: "TRAIN",
  CARPOOL: "CARPOOL",
  OTHER: "OTHER",
} as const;
export type TransportMode = (typeof TransportMode)[keyof typeof TransportMode];

/**
 * Statut d'un trajet côté organisation des navettes.
 * Volontairement non bloquant pour le pax : un trajet "TO_RECHECK" reste
 * modifiable, ce statut sert seulement de signal pour les organisateur·ices.
 */
export const TripStatus = {
  PENDING: "PENDING",
  ASSIGNED: "ASSIGNED",
  TO_RECHECK: "TO_RECHECK",
} as const;
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

/**
 * Niveau d'attente en gare entre l'heure du train et l'heure de la navette,
 * calculé automatiquement (remplace le code couleur manuel du Sheet).
 */
export const WaitLevel = {
  OK: "OK", // < 30 min
  MEDIUM: "MEDIUM", // >= 30 min (jaune dans le Sheet d'origine)
  HIGH: "HIGH", // >= 1h (orange dans le Sheet d'origine)
} as const;
export type WaitLevel = (typeof WaitLevel)[keyof typeof WaitLevel];

/**
 * Rôle d'un pax dans un covoiturage pour un trajet donné : conduit sa propre
 * voiture, ou est passager·e (d'une voiture identifiée, ou pas encore).
 */
export const CarpoolRole = {
  DRIVER: "DRIVER",
  PASSENGER: "PASSENGER",
} as const;
export type CarpoolRole = (typeof CarpoolRole)[keyof typeof CarpoolRole];

/**
 * Nuance du prêt de véhicule pour les navettes : certain·es pax acceptent de
 * prêter leur véhicule uniquement si c'est elleux qui le conduisent (question
 * d'assurance), d'autres l'acceptent même si quelqu'un d'autre conduit.
 */
export const VehicleLendingMode = {
  NOT_AVAILABLE: "NOT_AVAILABLE",
  ONLY_IF_OWNER_DRIVES: "ONLY_IF_OWNER_DRIVES",
  AVAILABLE_ANY_DRIVER: "AVAILABLE_ANY_DRIVER",
} as const;
export type VehicleLendingMode = (typeof VehicleLendingMode)[keyof typeof VehicleLendingMode];
