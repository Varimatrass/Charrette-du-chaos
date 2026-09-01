import { NiveauAttente, Sens } from "@desordre/shared-types";

const SEUIL_MOYEN_MIN = 30;
const SEUIL_ELEVE_MIN = 60;

function parseHeureEnMinutes(heure: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(heure.trim());
  if (!match) return null;
  const heures = Number(match[1]);
  const minutes = Number(match[2]);
  return heures * 60 + minutes;
}

/**
 * Calcule automatiquement le temps d'attente en gare entre l'heure de train
 * d'un pax et l'heure de passage de sa navette — reprend l'idée du code
 * couleur jaune/orange du Sheet d'origine, mais calculé plutôt que colorié
 * à la main.
 *
 * - ALLER : le pax arrive en train, la navette vient le récupérer en gare.
 *   Attente = heure d'arrivée de la navette en gare − heure du train.
 * - RETOUR : la navette dépose le pax en gare avant son train.
 *   Attente = heure du train − heure d'arrivée de la navette en gare.
 *
 * Renvoie `null` si une des heures manque ou est mal formée (on ne bloque
 * jamais l'affichage pour ça, on affiche juste "pas d'indicateur").
 */
export function calculerNiveauAttente(
  sens: Sens,
  heureTrajet: string | null,
  heureNavetteEnGare: string,
): NiveauAttente | null {
  if (!heureTrajet) return null;

  const minutesTrajet = parseHeureEnMinutes(heureTrajet);
  const minutesNavette = parseHeureEnMinutes(heureNavetteEnGare);
  if (minutesTrajet === null || minutesNavette === null) return null;

  const ecart = sens === Sens.ALLER ? minutesNavette - minutesTrajet : minutesTrajet - minutesNavette;
  const attenteMinutes = Math.max(ecart, 0);

  if (attenteMinutes >= SEUIL_ELEVE_MIN) return NiveauAttente.ELEVE;
  if (attenteMinutes >= SEUIL_MOYEN_MIN) return NiveauAttente.MOYEN;
  return NiveauAttente.OK;
}
