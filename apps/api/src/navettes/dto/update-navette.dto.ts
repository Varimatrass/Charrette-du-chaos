import { PartialType, OmitType } from "@nestjs/mapped-types";
import type { UpdateNavetteInput } from "@desordre/shared-types";
import { CreateNavetteDto } from "./create-navette.dto";

export class UpdateNavetteDto
  extends PartialType(OmitType(CreateNavetteDto, ["eventId"] as const))
  implements UpdateNavetteInput {}
