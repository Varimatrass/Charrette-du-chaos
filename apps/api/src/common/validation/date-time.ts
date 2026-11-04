import { applyDecorators } from "@nestjs/common";
import { IsDateString, Matches } from "class-validator";

/** Heure "HH:mm" sur 24 h (00:00 → 23:59), telle que l'envoie un `<input type="time">`. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Jour "YYYY-MM-DD", tel que l'envoie un `<input type="date">`. */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Le champ doit être une heure au format HH:mm. */
export const IsTime = () =>
  Matches(TIME_PATTERN, { message: "$property doit être une heure au format HH:mm" });

/** Le champ doit être un jour au format YYYY-MM-DD, et une vraie date. */
export const IsDay = () =>
  applyDecorators(
    Matches(DAY_PATTERN, { message: "$property doit être un jour au format AAAA-MM-JJ" }),
    IsDateString({ strict: true }, { message: "$property n'est pas une date valide" }),
  );
