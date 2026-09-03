import { IsDateString, IsNotEmpty, IsString } from "class-validator";
import type { CreateEventInput } from "@desordre/shared-types";

export class CreateEventDto implements CreateEventInput {
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  dateFin!: string;

  @IsString()
  @IsNotEmpty()
  lieu!: string;

  @IsString()
  @IsNotEmpty()
  gareReference!: string;
}
