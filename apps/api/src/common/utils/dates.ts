/**
 * Convertit une date ISO "YYYY-MM-DD" (ou vide/absente) en `Date` pour une
 * colonne `@db.Date` de Prisma. `undefined` reste `undefined` (champ non
 * fourni dans un update partiel), une chaîne vide ou `null` devient `null`.
 */
export function toDateOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  return new Date(value);
}

/** Version stricte pour un champ obligatoire : la chaîne doit être présente. */
export function toDate(value: string): Date {
  return new Date(value);
}

/** Jour au format "YYYY-MM-DD" d'une colonne `@db.Date`, pour comparer au jour près. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Jour lisible en français pour les messages d'erreur ("vendredi 12 juin"). */
export function frenchDay(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Les dates d'un évènement, pour vérifier qu'un jour tombe dedans. */
export interface EventDates {
  startDate: Date;
  endDate: Date;
}

/** Le jour est-il compris entre le début et la fin de l'évènement (inclus) ? */
export function isWithinEvent(event: EventDates, day: Date): boolean {
  const value = isoDay(day);
  return value >= isoDay(event.startDate) && value <= isoDay(event.endDate);
}

/** "du vendredi 10 juillet au dimanche 12 juillet", pour les messages d'erreur. */
export function frenchEventRange(event: EventDates): string {
  return `du ${frenchDay(event.startDate)} au ${frenchDay(event.endDate)}`;
}
