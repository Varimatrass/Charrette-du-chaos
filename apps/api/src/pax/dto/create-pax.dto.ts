import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import type { CreatePaxInput } from "@desordre/shared-types";

export class CreatePaxDto implements CreatePaxInput {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  nom!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactTelephone?: string;

  @IsOptional()
  @IsString()
  commentaire?: string;
}
