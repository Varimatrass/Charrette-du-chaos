import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { Sens } from "@desordre/shared-types";
import type { CreateNavetteInput } from "@desordre/shared-types";

export class CreateNavetteDto implements CreateNavetteInput {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  libelle!: string;

  @IsString()
  @IsNotEmpty()
  jour!: string;

  @IsEnum(Sens)
  sens!: Sens;

  @IsOptional()
  @IsString()
  conducteur?: string;

  @IsOptional()
  @IsString()
  vehicule?: string;

  @IsString()
  @IsNotEmpty()
  heureDepart!: string;

  @IsString()
  @IsNotEmpty()
  heureArriveeGare!: string;

  @IsOptional()
  @IsString()
  heureRetourLieu?: string;

  @IsInt()
  @Min(1)
  capacite!: number;

  @IsOptional()
  @IsString()
  commentaire?: string;
}
