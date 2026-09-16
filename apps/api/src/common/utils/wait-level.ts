import { Direction, WaitLevel } from "@desordre/shared-types";

/** Seuils (en minutes) à partir desquels l'attente en gare devient notable. */
export const WAIT_LEVEL_THRESHOLDS_MIN = {
  MEDIUM: 30,
  HIGH: 60,
} as const;

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

/**
 * Convertit une heure "HH:mm" en minutes depuis minuit.
 * Renvoie `null` si la chaîne est vide ou mal formée.
 */
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = TIME_PATTERN.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Calcule automatiquement le temps d'attente en gare entre l'heure de train
 * d'un pax et l'heure de passage de sa navette — reprend l'idée du code
 * couleur jaune/orange du Sheet d'origine, mais calculé plutôt que colorié
 * à la main.
 *
 * - OUTBOUND : le pax arrive en train, la navette vient le récupérer en gare.
 *   Attente = heure d'arrivée de la navette en gare − heure du train.
 * - RETURN : la navette dépose le pax en gare avant son train.
 *   Attente = heure du train − heure d'arrivée de la navette en gare.
 *
 * Renvoie `null` si une des heures manque ou est mal formée (on ne bloque
 * jamais l'affichage pour ça, on affiche juste "pas d'indicateur").
 */
export function computeWaitLevel(
  direction: Direction,
  tripTime: string | null,
  shuttleStationArrivalTime: string,
): WaitLevel | null {
  const tripMinutes = parseTimeToMinutes(tripTime);
  const shuttleMinutes = parseTimeToMinutes(shuttleStationArrivalTime);
  if (tripMinutes === null || shuttleMinutes === null) return null;

  const delta =
    direction === Direction.OUTBOUND ? shuttleMinutes - tripMinutes : tripMinutes - shuttleMinutes;
  const waitMinutes = Math.max(delta, 0);

  if (waitMinutes >= WAIT_LEVEL_THRESHOLDS_MIN.HIGH) return WaitLevel.HIGH;
  if (waitMinutes >= WAIT_LEVEL_THRESHOLDS_MIN.MEDIUM) return WaitLevel.MEDIUM;
  return WaitLevel.OK;
}
