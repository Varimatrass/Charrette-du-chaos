import { IsOptional, IsString } from "class-validator";
import type { CreateDriverAvailabilitySlotInput } from "@desordre/shared-types";

/** Un pax ayant accepté de conduire des navettes se déclare dispo ce jour-là. */
export class CreateDriverAvailabilitySlotDto implements CreateDriverAvailabilitySlotInput {
  @IsString()
  day!: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
