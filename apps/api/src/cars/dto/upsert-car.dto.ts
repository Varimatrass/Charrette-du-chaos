import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from "class-validator";
import { VehicleLendingMode } from "@desordre/shared-types";
import type { UpsertCarInput } from "@desordre/shared-types";

/** Création ou mise à jour de SA voiture (une seule par pax). */
export class UpsertCarDto implements UpsertCarInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  /** Places pour des passager·es, hors conducteur·ice. 0 = "je viens seul·e, pas de place". */
  @IsInt()
  @Min(0)
  @Max(20)
  seats!: number;

  @IsIn(Object.values(VehicleLendingMode))
  lendingMode!: VehicleLendingMode;
}
