import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import type { CreateStationInput } from "@desordre/shared-types";

export class CreateStationDto implements CreateStationInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
