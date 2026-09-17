/**
 * Renvoie une copie de l'objet sans ses clés à `undefined`.
 *
 * Utile pour construire le `data` d'un `update` Prisma à partir d'un DTO
 * partiel : un champ absent du body ne doit pas toucher la colonne, alors
 * qu'un champ explicitement `null` doit bien l'effacer. Remplace les longues
 * chaînes de `...(dto.x !== undefined && { x: dto.x })`.
 */
export function omitUndefined<T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const result: Partial<Record<keyof T, unknown>> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  return result as { [K in keyof T]?: Exclude<T[K], undefined> };
}

/** Renvoie une copie de l'objet sans les clés indiquées. */
export function omitKeys<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Omit<T, K> {
  const result = { ...value };
  for (const key of keys) delete result[key];
  return result;
}
