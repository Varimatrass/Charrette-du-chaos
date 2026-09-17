import { OmitType, PartialType } from "@nestjs/mapped-types";
import { IsIn, IsInt, IsNotEmpty, IsString, Min, ValidateIf } from "class-validator";
import { Direction } from "@desordre/shared-types";
import type { UpdateShuttleInput } from "@desordre/shared-types";
import { CreateShuttleDto } from "./create-shuttle.dto.js";

const REQUIRED_FIELDS = [
  "label",
  "day",
  "direction",
  "departureTime",
  "stationArrivalTime",
  "capacity",
] as const;

/** Ne valide que si le champ est présent dans le body (absent = pas touché ; `null` = refusé ici). */
const IfPresent = () => ValidateIf((_object, value: unknown) => value !== undefined);

/**
 * Mise à jour partielle : les champs facultatifs de la navette (conducteur·ice,
 * véhicule, commentaire...) peuvent être effacés avec `null`, les champs
 * obligatoires peuvent être omis mais jamais vidés.
 */
export class UpdateShuttleDto
  extends PartialType(OmitType(CreateShuttleDto, ["eventId", ...REQUIRED_FIELDS]))
  implements UpdateShuttleInput
{
  @IfPresent()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IfPresent()
  @IsString()
  @IsNotEmpty()
  day?: string;

  @IfPresent()
  @IsIn(Object.values(Direction))
  direction?: Direction;

  @IfPresent()
  @IsString()
  @IsNotEmpty()
  departureTime?: string;

  @IfPresent()
  @IsString()
  @IsNotEmpty()
  stationArrivalTime?: string;

  @IfPresent()
  @IsInt()
  @Min(1)
  capacity?: number;
}
