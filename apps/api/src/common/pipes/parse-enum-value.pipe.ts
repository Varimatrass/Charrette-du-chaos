import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

/**
 * Équivalent de `ParseEnumPipe` pour nos enums déclarés en objets `as const`
 * (voir shared-types) : accepte une valeur si elle fait partie des valeurs
 * de l'objet, renvoie 400 sinon.
 */
@Injectable()
export class ParseEnumValuePipe<T extends Record<string, string>> implements PipeTransform<
  string,
  T[keyof T]
> {
  private readonly allowed: readonly string[];

  constructor(enumObject: T) {
    this.allowed = Object.values(enumObject);
  }

  transform(value: string): T[keyof T] {
    if (!this.allowed.includes(value)) {
      throw new BadRequestException(
        `Valeur "${value}" invalide, valeurs acceptées : ${this.allowed.join(", ")}`,
      );
    }
    return value as T[keyof T];
  }
}
