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
