import { OmitType, PartialType } from "@nestjs/mapped-types";
import { IsNotEmpty, IsString, ValidateIf } from "class-validator";
import type { UpdatePaxInput } from "@desordre/shared-types";
import { CreatePaxDto } from "./create-pax.dto";

/**
 * Mise à jour partielle : un champ absent n'est pas touché, un champ à `null`
 * est effacé. L'évènement d'un pax ne change jamais après coup, et son nom
 * peut être modifié mais pas effacé.
 */
export class UpdatePaxDto
  extends PartialType(OmitType(CreatePaxDto, ["eventId", "name"] as const))
  implements UpdatePaxInput
{
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;
}
