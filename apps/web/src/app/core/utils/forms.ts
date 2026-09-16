/** Chaîne vide de formulaire -> `undefined` (champ non renseigné pour l'API). */
export function emptyToUndefined(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}

/**
 * L'API renvoie les dates en ISO complet ("2026-09-18T00:00:00.000Z") ;
 * un `<input type="date">` attend "AAAA-MM-JJ" : les 10 premiers
 * caractères suffisent dans les deux cas.
 */
export function toDateInputValue(isoDate: string | null | undefined): string {
  return isoDate ? isoDate.slice(0, 10) : "";
}

/** Chaîne vide de formulaire -> `null` (champ à effacer côté API, dans une mise à jour). */
export function emptyToNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

/** Applique `fn` à chaque valeur d'un objet, en conservant ses clés. */
export function mapValues<T extends Record<string, string>, R>(
  value: T,
  fn: (item: string) => R,
): { [K in keyof T]: R } {
  const result = {} as { [K in keyof T]: R };
  for (const key of Object.keys(value) as (keyof T)[]) {
    result[key] = fn(value[key]);
  }
  return result;
}
