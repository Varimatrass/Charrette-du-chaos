import { IsDay, IsTime } from "../../common/validation/date-time.js";
import { OmitType, PartialType } from "@nestjs/mapped-types";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
  IsBoolean,
  IsOptional,
} from "class-validator";
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
  @IsDay()
  day?: string;

  @IfPresent()
  @IsIn(Object.values(Direction))
  direction?: Direction;

  @IfPresent()
  @IsTime()
  departureTime?: string;

  @IfPresent()
  @IsTime()
  stationArrivalTime?: string;

  @IfPresent()
  @IsInt()
  @Min(1)
  capacity?: number;

  /** Retire les passager·es rendu·es incompatibles par la modif (sinon 409). */
  @IsOptional()
  @IsBoolean()
  removeIncompatible?: boolean;
}
