import { IsDateString, IsNotEmpty, IsString } from "class-validator";
import type { CreateEventInput } from "@desordre/shared-types";

export class CreateEventDto implements CreateEventInput {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsNotEmpty()
  referenceStation!: string;
}
