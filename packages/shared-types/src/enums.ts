/**
 * Sens d'un trajet ou d'une navette : à l'aller (vers le lieu de l'évènement)
 * ou au retour (vers la gare / le domicile).
 */
export enum Sens {
  ALLER = "ALLER",
  RETOUR = "RETOUR",
}

/**
 * Moyen de transport utilisé par un pax pour un trajet donné.
 * V1 ne traite en détail que TRAIN (navettes) ; COVOITURAGE est capté
 * dès maintenant pour ne pas avoir à resaisir l'info à l'itération suivante.
 */
export enum ModeTransport {
  TRAIN = "TRAIN",
  COVOITURAGE = "COVOITURAGE",
  AUTRE = "AUTRE",
}

/**
 * Statut d'un trajet côté organisation des navettes.
 * Volontairement non bloquant pour le pax : un trajet "A_REVERIFIER"
 * reste modifiable, ce statut sert seulement de signal pour les organisateur·ices.
 */
export enum StatutTrajet {
  EN_ATTENTE = "EN_ATTENTE",
  ASSIGNE = "ASSIGNE",
  A_REVERIFIER = "A_REVERIFIER",
}

/**
 * Niveau d'attente en gare entre l'heure du train et l'heure de la navette,
 * calculé automatiquement (remplace le code couleur manuel du Sheet).
 */
export enum NiveauAttente {
  OK = "OK", // < 30 min
  MOYEN = "MOYEN", // >= 30 min (jaune dans le Sheet d'origine)
  ELEVE = "ELEVE", // >= 1h (orange dans le Sheet d'origine)
}
