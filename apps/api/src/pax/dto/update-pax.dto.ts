import { IsEmail, IsOptional, IsString } from "class-validator";
import type { UpdatePaxInput } from "@desordre/shared-types";

export class UpdatePaxDto implements UpdatePaxInput {
  @IsOptional()
  @IsString()
  nom?: string;

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
