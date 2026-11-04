import { IsDay, IsTime } from "../../common/validation/date-time.js";
import { IsOptional, IsString } from "class-validator";
import type { CreateDriverAvailabilitySlotInput } from "@desordre/shared-types";

/** Un pax ayant accepté de conduire des navettes se déclare dispo ce jour-là. */
export class CreateDriverAvailabilitySlotDto implements CreateDriverAvailabilitySlotInput {
  @IsDay()
  day!: string;

  @IsOptional()
  @IsTime()
  startTime?: string;

  @IsOptional()
  @IsTime()
  endTime?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
