import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from "class-validator";
import type { UpdateEventInput } from "@desordre/shared-types";

/** Ne valide que si le champ est présent (absent = pas touché). */
const IfPresent = () => ValidateIf((_object, value: unknown) => value !== undefined);

export class UpdateEventDto implements UpdateEventInput {
  @IfPresent()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IfPresent()
  @IsDateString()
  startDate?: string;

  @IfPresent()
  @IsDateString()
  endDate?: string;

  @IfPresent()
  @IsString()
  @IsNotEmpty()
  location?: string;

  @IfPresent()
  @IsBoolean()
  openToPaxs?: boolean;

  /** `null` = plus de gare préférée. */
  @IsOptional()
  @IsUUID()
  preferredStationId?: string | null;
}
