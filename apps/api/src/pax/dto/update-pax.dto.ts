import { OmitType, PartialType } from "@nestjs/mapped-types";
import type { UpdatePaxInput } from "@desordre/shared-types";
import { CreatePaxDto } from "./create-pax.dto";

/** Tout est facultatif ; l'évènement d'un pax ne change jamais après coup. */
export class UpdatePaxDto
  extends PartialType(OmitType(CreatePaxDto, ["eventId"] as const))
  implements UpdatePaxInput {}
