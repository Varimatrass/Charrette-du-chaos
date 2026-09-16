import { OmitType, PartialType } from "@nestjs/mapped-types";
import type { UpdateShuttleInput } from "@desordre/shared-types";
import { CreateShuttleDto } from "./create-shuttle.dto";

export class UpdateShuttleDto
  extends PartialType(OmitType(CreateShuttleDto, ["eventId"] as const))
  implements UpdateShuttleInput {}
