import { IsDateString, IsNotEmpty, IsString } from "class-validator";
import type { CreateEditionInput } from "@desordre/shared-types";

export class CreateEditionDto implements CreateEditionInput {
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
