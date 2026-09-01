import { IsNotEmpty, IsString, IsUUID } from "class-validator";
import type { RechercherPaxQuery } from "@desordre/shared-types";

export class RechercherPaxDto implements RechercherPaxQuery {
  @IsUUID()
  editionId!: string;

  @IsString()
  @IsNotEmpty()
  nom!: string;
}
